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
        // check DB
        const user = await this.verifyUser(ctx.params.email, ctx.params.password);
        if (!user) {
          return { success: false, message: "Invalid credentials" };
        }

        const payload = { id: user.id, email: user.email, role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
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

    // ====== STOCKS (READ for UI lists)
    listAssets: {
      params: {
        q:      { type: "string", optional: true },
        limit:  { type: "number", integer: true, optional: true, convert: true, default: 50 },
        offset: { type: "number", integer: true, optional: true, convert: true, default: 0 }
      },
      async handler(ctx) {
        const { q, limit, offset } = ctx.params;
        const where = [];
        const args = [];
        let i = 1;

        if (q && q.trim()) {
          where.push(`(ticker ILIKE $${i} OR name ILIKE $${i})`);
          args.push(`%${q.trim()}%`);
          i++;
        }

        const sql = `
          SELECT
            ticker,
            name,
            exchange,
            sector,
            currency,
            total_shares,
            initial_price
          FROM symbol
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY ticker ASC
          LIMIT $${i} OFFSET $${i + 1};
        `;
        args.push(limit, offset);

        const { rows } = await pool.query(sql, args);
        return { ok: true, data: rows };
      }
    },

    getAsset: {
      params: { ticker: "string" },
      async handler(ctx) {
        const t = ctx.params.ticker.toUpperCase().trim();
        const { rows } = await pool.query(
          `SELECT
             ticker,
             name,
             exchange,
             sector,
             currency,
             total_shares,
             initial_price
           FROM symbol
           WHERE ticker = $1`,
          [t]
        );
        if (!rows[0]) return { ok: false, error: "Symbol not found" };
        return { ok: true, data: rows[0] };
      }
    },

    // ====== ACCOUNTS ======
    depositCash: {
      params: { userId: "string", amount: "number" },
      async handler(ctx) {
        return await this.adjustCash(ctx.params.userId, ctx.params.amount, "deposit");
      }
    },

    withdrawCash: {
      params: { userId: "string", amount: "number" },
      async handler(ctx) {
        return await this.adjustCash(ctx.params.userId, -ctx.params.amount, "withdrawal");
      }
    },

    // ---- fetch balance for a user
    getBalance: {
      params: { userId: "string" },
      async handler(ctx) {
        const res = await pool.query(
          `SELECT currency, cash_balance FROM account WHERE user_id=$1 LIMIT 1`,
          [ctx.params.userId]
        );
        if (res.rows.length === 0) throw new Error("Account not found");
        const { currency, cash_balance } = res.rows[0];
        return { balance: Number(cash_balance), currency: currency || "USD" };
      }
    },


// ---- Get Transaction History
    getTransactionHistory: {
      params: { userId: "string" },
      async handler(ctx) {
        const res = await pool.query(`
          SELECT c.type, c.amount, c.created_at
          FROM cash_txn c
          JOIN account a ON c.account_id = a.account_id
          WHERE a.user_id = $1
          ORDER BY c.created_at DESC
        `, [ctx.params.userId]);
        return res.rows;
      }
    },

    // ---- Get Order History
    getOrderHistory: {
      params: { userId: "string" },
      async handler(ctx) {
        const res = await pool.query(`
          SELECT o.side, s.ticker, o.quantity, o.price, o.status, o.created_at
          FROM app_order o
          JOIN account a ON o.account_id = a.account_id
          JOIN symbol s ON o.symbol_id = s.symbol_id
          WHERE a.user_id = $1
          ORDER BY o.created_at DESC
        `, [ctx.params.userId]);
        return res.rows;
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
      let roleQuery = `SELECT role_id, name FROM role WHERE name = 'customer'`;
      if (email.endsWith("@asu.edu")) {
        roleQuery = `SELECT role_id, name FROM role WHERE name = 'admin'`;
      }
      const roleResult = await pool.query(roleQuery);
      const { role_id: roleId, name: roleName } = roleResult.rows[0];

      const existing = await pool.query(`SELECT email FROM app_user WHERE email=$1`, [email]);
      if (existing.rows.length > 0) {
        throw new Error("Email already registered");
      }

      const query = `
        INSERT INTO app_user (email, password_hash, full_name, role_id)
        VALUES ($1, $2, $3, $4)
        RETURNING user_id, email, full_name
      `;
      const values = [email, passwordHash, fullName, roleId];
      const result = await pool.query(query, values);

      const user = result.rows[0];
      user.role = roleName;

      const accountQuery = `
        INSERT INTO account (user_id, account_type, currency, cash_balance)
        VALUES ($1, 'cash', 'USD', 0)
        RETURNING account_id, cash_balance, status
      `;
      const accountResult = await pool.query(accountQuery, [user.user_id]);
      const account = accountResult.rows[0];

      return { user, account };
    },

    async verifyUser(email, password) {
      const query = `
        SELECT u.user_id, u.email, u.full_name, u.password_hash, r.name AS role_name
        FROM app_user u
        JOIN role r ON u.role_id = r.role_id
        WHERE u.email = $1
      `;
      const result = await pool.query(query, [email]);
      if (result.rows.length === 0) return null;

      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return null;

      return {
        id: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role_name
      };
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
      // 1) Try the canonical positions table first
      const query = `
        SELECT s.ticker, s.name, p.quantity, p.avg_cost
        FROM position p
        JOIN account a ON p.account_id=a.account_id
        JOIN symbol s ON p.symbol_id=s.symbol_id
        WHERE a.user_id=$1
      `;
      const res = await pool.query(query, [userId]);
      if (res.rows.length > 0) return res.rows;

      // 2) Fallback: derive from historical orders (buys - sells), ignore canceled
      const derived = await pool.query(
        `
        SELECT
          s.ticker,
          s.name,
          /* net quantity: buys - sells */
          SUM(CASE WHEN o.side='buy' THEN o.quantity ELSE -o.quantity END)::numeric AS quantity,
          /* weighted average cost from BUY legs only */
          CASE
            WHEN SUM(CASE WHEN o.side='buy' THEN o.quantity ELSE 0 END) > 0
              THEN (
                SUM(CASE WHEN o.side='buy' THEN (o.quantity * o.price) ELSE 0 END)
                / SUM(CASE WHEN o.side='buy' THEN o.quantity ELSE 0 END)
              )
            ELSE 0
          END::numeric AS avg_cost
        FROM app_order o
        JOIN account a ON o.account_id = a.account_id
        JOIN symbol  s ON o.symbol_id  = s.symbol_id
        WHERE a.user_id = $1
          AND COALESCE(o.status,'') <> 'canceled'
        GROUP BY s.ticker, s.name
        HAVING SUM(CASE WHEN o.side='buy' THEN o.quantity ELSE -o.quantity END) > 0
        `,
        [userId]
      );

      // map numeric -> Number for frontend
      return (derived.rows || []).map(r => ({
        ticker: r.ticker,
        name: r.name,
        quantity: Number(r.quantity || 0),
        avg_cost: Number(r.avg_cost || 0)
      }));
    },

    // ============ ORDERS ============
    async placeOrder({ userId, symbol, side, quantity }) {
      // Enforce positive integer quantity & listed symbols only
      const qtyNum = Number(quantity);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0 || !Number.isInteger(qtyNum)) {
        throw new Error("Quantity must be a positive integer");
      }
      if (!["buy", "sell"].includes(side)) throw new Error("Invalid side");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Lock account
        const accRes = await client.query(
          `SELECT account_id, cash_balance FROM account WHERE user_id=$1 FOR UPDATE`,
          [userId]
        );
        if (accRes.rows.length === 0) throw new Error("Account not found");
        const account = accRes.rows[0];

        // Only allow listed symbols
        const normTicker = String(symbol).toUpperCase().trim();
        const symRes = await client.query(
          `SELECT symbol_id, ticker, name, initial_price FROM symbol WHERE ticker=$1`,
          [normTicker]
        );
        if (symRes.rows.length === 0) throw new Error("Symbol not listed");

        const stock = symRes.rows[0];
        const price = Number(stock.initial_price || 0);
        if (!(price > 0)) throw new Error("Invalid price");

        const notional = price * qtyNum;

        if (side === "buy") {
          if (Number(account.cash_balance) < notional) throw new Error("Insufficient funds");

          // Debit cash
          await client.query(
            `UPDATE account SET cash_balance = cash_balance - $1 WHERE account_id=$2`,
            [notional, account.account_id]
          );

          // Upsert position with weighted average
          const posRes = await client.query(
            `SELECT position_id, quantity, avg_cost
               FROM position
              WHERE account_id=$1 AND symbol_id=$2
              FOR UPDATE`,
            [account.account_id, stock.symbol_id]
          );

          if (posRes.rows.length) {
            const pos = posRes.rows[0];
            const oldQty = Number(pos.quantity || 0);
            const oldAvg = Number(pos.avg_cost || 0);
            const newQty = oldQty + qtyNum;
            const newAvg = (oldAvg * oldQty + price * qtyNum) / newQty;

            await client.query(
              `UPDATE position SET quantity=$1, avg_cost=$2 WHERE position_id=$3`,
              [newQty, newAvg, pos.position_id]
            );
          } else {
            await client.query(
              `INSERT INTO position (account_id, symbol_id, quantity, avg_cost)
               VALUES ($1,$2,$3,$4)`,
              [account.account_id, stock.symbol_id, qtyNum, price]
            );
          }
        } else {
          // SELL
          const posRes = await client.query(
            `SELECT position_id, quantity, avg_cost
               FROM position
              WHERE account_id=$1 AND symbol_id=$2
              FOR UPDATE`,
            [account.account_id, stock.symbol_id]
          );
          if (!posRes.rows.length) throw new Error("No position to sell");
          const pos = posRes.rows[0];
          const curQty = Number(pos.quantity || 0);
          if (curQty < qtyNum) throw new Error("Sell quantity exceeds position");

          const newQty = curQty - qtyNum;

          // Credit cash
          await client.query(
            `UPDATE account SET cash_balance = cash_balance + $1 WHERE account_id=$2`,
            [notional, account.account_id]
          );

          // Reduce or remove position
          if (newQty > 0) {
            await client.query(
              `UPDATE position SET quantity=$1 WHERE position_id=$2`,
              [newQty, pos.position_id]
            );
          } else {
            await client.query(
              `DELETE FROM position WHERE position_id=$1`,
              [pos.position_id]
            );
          }
        }

        // Record order
        const orderRes = await client.query(
          `INSERT INTO app_order (account_id, symbol_id, side, quantity, price)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [account.account_id, stock.symbol_id, side, qtyNum, price]
        );

        await client.query("COMMIT");
        return orderRes.rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
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
