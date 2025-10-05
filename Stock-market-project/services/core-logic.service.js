"use strict";
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const JWT_SECRET = "dev_secret_change_me";

// DB connection pool
const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "stockdb",
  port: process.env.PGPORT || 5432,
});

module.exports = {
  name: "core-logic",

  actions: {
    // ====== USERS ======
    registerUser: {
      params: {
        email: "string",
        password: "string",
        fullName: "string"
      },
      async handler(ctx) {
        // hash the password before creating user
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(ctx.params.password, saltRounds);

        const user = await this.createUser({
          email: ctx.params.email,
          passwordHash,       // pass hashed password
          fullName: ctx.params.fullName
        });

        return { message: "User registered", user };
      }
    },

    loginUser: {
      params: {
        email: "string",
        password: "string"
      },
      async handler(ctx) {
        // Verify credentials
        const user = await this.verifyUser(ctx.params.email, ctx.params.password);
        if (!user) {
          // Keep same shape as before but include success: false
          return { success: false, message: "Invalid credentials" };
        }

        // Build a small token payload (avoid putting secrets or heavy objects in token)
        const payload = {
          id: user.id,
          email: user.email,
          role: user.role
        };

        // Sign JWT (expires in 2 hours)
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });

        // Return shape frontend expects: success, token, user
        // Note: keep user fields minimal and non-sensitive
        return { success: true, token, user };
      }
    },


    // ====== STOCKS (Admin only) ======
    createStock: {
      params: {
        ticker: "string",
        name: "string",
        exchange: "string",
        sector: "string",
        currency: "string",
        totalShares: "number",
        initialPrice: "number"
      },
      async handler(ctx) {
        const stock = await this.insertSymbol(ctx.params);
        return { message: "Stock created", stock };
      }
    },

    // ====== ACCOUNTS ======
    depositCash: {
      params: {
        userId: "string",
        amount: "number"
      },
      async handler(ctx) {
        return await this.adjustCash(ctx.params.userId, ctx.params.amount, "deposit");
      }
    },

    withdrawCash: {
      params: {
        userId: "string",
        amount: "number"
      },
      async handler(ctx) {
        return await this.adjustCash(ctx.params.userId, -ctx.params.amount, "withdrawal");
      }
    },

    getPortfolio: {
      params: { userId: "string" },
      async handler(ctx) {
        return await this.getUserPortfolio(ctx.params.userId);
      }
    },

    // ====== ORDERS ======
    placeOrder: {
      params: {
        userId: "string",
        symbol: "string",
        side: "string",
        quantity: "number"
      },
      async handler(ctx) {
        return await this.placeOrder(ctx.params);
      }
    },

    cancelOrder: {
      params: { orderId: "string" },
      async handler(ctx) {
        return await this.cancelOrder(ctx.params.orderId);
      }
    }
  },

  methods: {
    // ============ USERS ============
    async createUser({ email, passwordHash, fullName }) {
      // decide role
      let roleQuery = `SELECT role_id FROM role WHERE name = 'customer'`;
      if (email.endsWith("@asu.edu")) {
        roleQuery = `SELECT role_id FROM role WHERE name = 'admin'`;
      }
      const roleResult = await pool.query(roleQuery);
      const roleId = roleResult.rows[0].role_id;

      const query = `
        INSERT INTO app_user (email, password_hash, full_name, role_id)
        VALUES ($1, $2, $3, $4)
        RETURNING user_id, email, full_name, role_id
      `;

      const values = [email, passwordHash, fullName, roleId];
      const result = await pool.query(query, values);

      return result.rows[0];
    },


    async verifyUser(email, password) {
      const query = `SELECT * FROM app_user WHERE email=$1`;
      const result = await pool.query(query, [email]);
      if (result.rows.length === 0) return null;

      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return null;

      return { id: user.user_id, email: user.email, fullName: user.full_name, role: user.role_id };
    },

    // ============ STOCKS ============
    async insertSymbol({ ticker, name, exchange, sector, currency, totalShares, initialPrice }) {
      const query = `
        INSERT INTO symbol (ticker, name, exchange, sector, currency, total_shares, initial_price)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `;
      const result = await pool.query(query, [ticker, name, exchange, sector, currency, totalShares, initialPrice]);
      return result.rows[0];
    },

    // ============ CASH ============
    async adjustCash(userId, amount, type) {
      const accountRes = await pool.query(`SELECT account_id, cash_balance FROM account WHERE user_id=$1`, [userId]);
      if (accountRes.rows.length === 0) throw new Error("Account not found");
      const account = accountRes.rows[0];
      const newBalance = Number(account.cash_balance) + Number(amount);
      if (newBalance < 0) throw new Error("Insufficient funds");

      await pool.query(`UPDATE account SET cash_balance=$1 WHERE account_id=$2`, [newBalance, account.account_id]);
      await pool.query(
        `INSERT INTO cash_txn (account_id, type, amount) VALUES ($1, $2, $3)`,
        [account.account_id, type, Math.abs(amount)]
      );

      return { balance: newBalance };
    },

    // ============ PORTFOLIO ============
    async getUserPortfolio(userId) {
      const query = `
        SELECT s.ticker, s.name, p.quantity, p.avg_cost
        FROM position p
        JOIN account a ON p.account_id=a.account_id
        JOIN symbol s ON p.symbol_id=s.symbol_id
        WHERE a.user_id=$1
      `;
      const result = await pool.query(query, [userId]);
      return result.rows;
    },

    // ============ ORDERS ============
    async placeOrder({ userId, symbol, side, quantity }) {
      // get account
      const accountRes = await pool.query(`SELECT account_id, cash_balance FROM account WHERE user_id=$1`, [userId]);
      if (accountRes.rows.length === 0) throw new Error("Account not found");
      const account = accountRes.rows[0];

      // get stock price
      const symbolRes = await pool.query(`SELECT * FROM symbol WHERE ticker=$1`, [symbol]);
      if (symbolRes.rows.length === 0) throw new Error("Symbol not found");
      const stock = symbolRes.rows[0];
      const price = stock.initial_price; // for now static

      if (side === "buy" && account.cash_balance < quantity * price) {
        throw new Error("Insufficient funds");
      }

      const orderRes = await pool.query(
        `INSERT INTO app_order (account_id, symbol_id, side, quantity, price) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [account.account_id, stock.symbol_id, side, quantity, price]
      );

      return orderRes.rows[0];
    },

    async cancelOrder(orderId) {
      const res = await pool.query(
        `UPDATE app_order SET status='canceled', canceled_at=NOW() WHERE order_id=$1 RETURNING *`,
        [orderId]
      );
      if (res.rows.length === 0) throw new Error("Order not found");
      return res.rows[0];
    }
  }
};

