const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.VITE_PAYMENT_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

// Middleware configuration:
const corsConfig = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
};

app.use(cors(corsConfig));
app.use(express.json());