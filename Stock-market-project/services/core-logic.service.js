"use strict";
const { Pool } = require("pg");

// DB connection pool (reuse across service lifecycle)
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
        username: "string",
        password: "string",
        firstName: "string",
        lastName: "string",
        email: "string",
        phoneNumber: "string"
      },
      async handler(ctx) {
        const user = await this.createUser(ctx.params);
        return { message: "User registered", user };
      }
    },

    loginUser: {
      params: {
        username: "string",
        password: "string"
      },
      async handler(ctx) {
        const user = await this.verifyUser(ctx.params.username, ctx.params.password);
        if (!user) return { success: false, message: "Invalid credentials" };
        return { success: true, user };
      }
    },

    // ====== STOCKS ======
    createStock: {
      params: {
        companyName: "string",
        stockTicker: "string",
        totalSharesAvailable: "number",
        initialSharePrice: "number"
      },
      async handler(ctx) {
        const stock = await this.insertStock(ctx.params);
        return { message: "Stock created", stock };
      }
    },

    getStock: {
      params: { id: "number" },
      async handler(ctx) {
        const stock = await this.findStockById(ctx.params.id);
        if (!stock) return { message: "Not found" };
        return stock;
      }
    }
  },

  methods: {
    // ============ PRIVATE DB HELPERS ============

    async createUser({ username, password, firstName, lastName, email, phoneNumber }) {
      const query = `
        INSERT INTO users (username, password, first_name, last_name, email, phone_number)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, first_name, last_name, email, phone_number
      `;
      const values = [username, password, firstName, lastName, email, phoneNumber];
      const result = await pool.query(query, values);
      return result.rows[0];
    },

    async verifyUser(username, password) {
      const query = `SELECT id, username, password, first_name FROM users WHERE username=$1`;
      const result = await pool.query(query, [username]);
      if (result.rows.length === 0) return null;

      // TODO: hash + compare with bcrypt
      const user = result.rows[0];
      if (user.password !== password) return null;
      return { id: user.id, username: user.username, firstName: user.first_name };
    },

    async insertStock({ companyName, stockTicker, totalSharesAvailable, initialSharePrice }) {
      const query = `
        INSERT INTO stocks (company_name, stock_ticker, total_shares, share_price)
        VALUES ($1, $2, $3, $4) RETURNING *
      `;
      const values = [companyName, stockTicker, totalSharesAvailable, initialSharePrice];
      const result = await pool.query(query, values);
      return result.rows[0];
    },

    async findStockById(id) {
      const query = `SELECT * FROM stocks WHERE id=$1`;
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    }
  }
};
