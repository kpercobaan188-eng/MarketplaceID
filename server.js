const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   MIDDLEWARE
========================= */

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "marketplaceid_secret_v3",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

/* =========================
   STATIC FOLDERS
========================= */

app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* =========================
   DATABASE FILES
========================= */

const USERS_DB = path.join(__dirname, "database/users.json");
const PRODUCTS_DB = path.join(__dirname, "database/products.json");
const CHATS_DB = path.join(__dirname, "database/chats.json");
const ORDERS_DB = path.join(__dirname, "database/orders.json");
const FAVORITES_DB = path.join(__dirname, "database/favorites.json");
const NOTIFICATIONS_DB = path.join(__dirname, "database/notifications.json");
const REPORTS_DB = path.join(__dirname, "database/reports.json");
const REVIEWS_DB = path.join(__dirname, "database/reviews.json");
const VERIFICATIONS_DB = path.join(__dirname, "database/verifications.json");
const FOLLOWS_DB = path.join(__dirname, "database/follows.json");
const LOCATIONS_DB = path.join(__dirname, "database/locations.json");

/* =========================
   HELPERS
========================= */

async function readJSON(file) {
  try {
    return await fs.readJson(file);
  } catch (err) {
    return {};
  }
}

async function writeJSON(file, data) {
  await fs.writeJson(file, data, {
    spaces: 2
  });
}

function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

/* =========================
   AUTH MIDDLEWARE
========================= */

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Login diperlukan"
    });
  }

  next();
}

/* =========================
   ROOT API
========================= */

app.get("/api", (req, res) => {
  res.json({
    success: true,
    app: "MarketplaceID",
    version: "3.0.0"
  });
});

/* =========================
   REGISTER
========================= */

app.post("/api/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password
    } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Semua field wajib diisi"
      });
    }

    const db = await readJSON(USERS_DB);
    const users = db.users || [];

    const usernameExist = users.find(
      user =>
        user.username.toLowerCase() ===
        username.toLowerCase()
    );

    if (usernameExist) {
      return res.status(400).json({
        success: false,
        message: "Username sudah digunakan"
      });
    }

    const emailExist = users.find(
      user =>
        user.email.toLowerCase() ===
        email.toLowerCase()
    );

    if (emailExist) {
      return res.status(400).json({
        success: false,
        message: "Email sudah digunakan"
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const newUser = {
      id: generateId(),
      username,
      email,
      password: hashedPassword,
      avatar:
        "/uploads/profiles/default-avatar.png",
      bio: "",
      city: "",
      verified: false,
      rating: 0,
      reviewCount: 0,
      reportCount: 0,
      followers: 0,
      createdAt: Date.now()
    };

    users.push(newUser);

    await writeJSON(USERS_DB, {
      users
    });

    res.json({
      success: true,
      message: "Register berhasil"
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* =========================
   LOGIN
========================= */

app.post("/api/login", async (req, res) => {
  try {
    const {
      login,
      password
    } = req.body;

    const db = await readJSON(USERS_DB);
    const users = db.users || [];

    const user = users.find(
      u =>
        u.username.toLowerCase() ===
          login.toLowerCase() ||
        u.email.toLowerCase() ===
          login.toLowerCase()
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Akun tidak ditemukan"
      });
    }

    const match =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Password salah"
      });
    }

    req.session.userId = user.id;

    res.json({
      success: true,
      message: "Login berhasil",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        verified: user.verified
      }
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* =========================
   LOGOUT
========================= */

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      success: true,
      message: "Logout berhasil"
    });
  });
});

/* =========================
   CURRENT USER
========================= */

app.get(
  "/api/me",
  requireLogin,
  async (req, res) => {
    const db = await readJSON(USERS_DB);

    const users = db.users || [];

    const user = users.find(
      u => u.id === req.session.userId
    );

    if (!user) {
      return res.status(404).json({
        success: false
      });
    }

    res.json({
      success: true,
      user
    });
  }
);

/* =========================
   MULTER PRODUCT UPLOAD
========================= */

const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(
      null,
      path.join(
        __dirname,
        "uploads/products"
      )
    );
  },

  filename: function (req, file, cb) {
    const ext =
      path.extname(file.originalname);

    cb(
      null,
      Date.now() +
        "-" +
        Math.floor(Math.random() * 99999) +
        ext
    );
  }
});

const uploadProduct = multer({
  storage: productStorage
});

/* =========================
   GET ALL PRODUCTS
========================= */

app.get(
  "/api/products",
  async (req, res) => {
    try {
      const db =
        await readJSON(PRODUCTS_DB);

      const products =
        db.products || [];

      const activeProducts =
        products.filter(
          p => p.status !== "deleted"
        );

      activeProducts.sort(
        (a, b) =>
          b.createdAt - a.createdAt
      );

      res.json({
        success: true,
        products: activeProducts
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   GET PRODUCT DETAIL
========================= */

app.get(
  "/api/products/:id",
  async (req, res) => {
    try {
      const productId =
        Number(req.params.id);

      const db =
        await readJSON(PRODUCTS_DB);

      const products =
        db.products || [];

      const product =
        products.find(
          p => p.id === productId
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          message:
            "Produk tidak ditemukan"
        });
      }

      product.views =
        (product.views || 0) + 1;

      await writeJSON(
        PRODUCTS_DB,
        {
          products
        }
      );

      res.json({
        success: true,
        product
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   ADD PRODUCT
========================= */

app.post(
  "/api/products",
  requireLogin,
  uploadProduct.array(
    "images",
    10
  ),
  async (req, res) => {
    try {
      const {
        title,
        price,
        category,
        condition,
        description,
        location
      } = req.body;

      if (
        !title ||
        !price ||
        !category
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Data produk belum lengkap"
        });
      }

      const imagePaths =
        req.files.map(
          file =>
            "/uploads/products/" +
            file.filename
        );

      const db =
        await readJSON(PRODUCTS_DB);

      const products =
        db.products || [];

      const newProduct = {
        id: generateId(),
        sellerId:
          req.session.userId,
        title,
        price: Number(price),
        category,
        condition:
          condition || "Bekas",
        description:
          description || "",
        location:
          location || "",
        images: imagePaths,
        status: "active",
        views: 0,
        favorites: 0,
        createdAt: Date.now()
      };

      products.push(newProduct);

      await writeJSON(
        PRODUCTS_DB,
        {
          products
        }
      );

      res.json({
        success: true,
        message:
          "Produk berhasil ditambahkan",
        product: newProduct
      });

    } catch (err) {
      console.log(err);

      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   EDIT PRODUCT
========================= */

app.put(
  "/api/products/:id",
  requireLogin,
  async (req, res) => {
    try {
      const productId =
        Number(req.params.id);

      const db =
        await readJSON(PRODUCTS_DB);

      const products =
        db.products || [];

      const product =
        products.find(
          p => p.id === productId
        );

      if (!product) {
        return res.status(404).json({
          success: false
        });
      }

      if (
        product.sellerId !==
        req.session.userId
      ) {
        return res.status(403).json({
          success: false
        });
      }

      product.title =
        req.body.title ||
        product.title;

      product.price =
        Number(req.body.price) ||
        product.price;

      product.category =
        req.body.category ||
        product.category;

      product.condition =
        req.body.condition ||
        product.condition;

      product.description =
        req.body.description ||
        product.description;

      product.location =
        req.body.location ||
        product.location;

      await writeJSON(
        PRODUCTS_DB,
        {
          products
        }
      );

      res.json({
        success: true,
        message:
          "Produk berhasil diupdate"
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   DELETE PRODUCT
========================= */

app.delete(
  "/api/products/:id",
  requireLogin,
  async (req, res) => {
    try {
      const productId =
        Number(req.params.id);

      const db =
        await readJSON(PRODUCTS_DB);

      const products =
        db.products || [];

      const product =
        products.find(
          p => p.id === productId
        );

      if (!product) {
        return res.status(404).json({
          success: false
        });
      }

      if (
        product.sellerId !==
        req.session.userId
      ) {
        return res.status(403).json({
          success: false
        });
      }

      product.status =
        "deleted";

      await writeJSON(
        PRODUCTS_DB,
        {
          products
        }
      );

      res.json({
        success: true,
        message:
          "Produk berhasil dihapus"
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   MARK SOLD
========================= */

app.put(
  "/api/products/:id/sold",
  requireLogin,
  async (req, res) => {
    try {
      const productId =
        Number(req.params.id);

      const db =
        await readJSON(PRODUCTS_DB);

      const products =
        db.products || [];

      const product =
        products.find(
          p => p.id === productId
        );

      if (!product) {
        return res.status(404).json({
          success: false
        });
      }

      product.status =
        "sold";

      await writeJSON(
        PRODUCTS_DB,
        {
          products
        }
      );

      res.json({
        success: true,
        message:
          "Produk ditandai terjual"
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   SEARCH PRODUCT
========================= */

app.get(
  "/api/search",
  async (req, res) => {
    try {
      const keyword =
        (
          req.query.q || ""
        ).toLowerCase();

      const db =
        await readJSON(PRODUCTS_DB);

      const products =
        db.products || [];

      const result =
        products.filter(
          product =>
            product.status ===
              "active" &&
            (
              product.title ||
              ""
            )
              .toLowerCase()
              .includes(keyword)
        );

      res.json({
        success: true,
        products: result
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   CATEGORY PRODUCTS
========================= */

app.get(
  "/api/category/:name",
  async (req, res) => {
    try {
      const category =
        req.params.name
          .toLowerCase();

      const db =
        await readJSON(PRODUCTS_DB);

      const products =
        db.products || [];

      const result =
        products.filter(
          p =>
            p.status ===
              "active" &&
            p.category
              .toLowerCase() ===
              category
        );

      res.json({
        success: true,
        products: result
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   LATEST PRODUCTS
========================= */

app.get(
  "/api/latest-products",
  async (req, res) => {
    try {
      const db =
        await readJSON(PRODUCTS_DB);

      const products =
        db.products || [];

      const latest =
        products
          .filter(
            p =>
              p.status ===
              "active"
          )
          .sort(
            (a, b) =>
              b.createdAt -
              a.createdAt
          )
          .slice(0, 20);

      res.json({
        success: true,
        products: latest
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   FAVORITES
========================= */

app.post(
  "/api/favorites/:productId",
  requireLogin,
  async (req, res) => {
    try {
      const productId = Number(req.params.productId);

      const favDB = await readJSON(FAVORITES_DB);
      const favorites = favDB.favorites || [];

      const exists = favorites.find(
        f =>
          f.userId === req.session.userId &&
          f.productId === productId
      );

      if (exists) {
        return res.json({
          success: false,
          message: "Sudah ada di favorit"
        });
      }

      favorites.push({
        userId: req.session.userId,
        productId,
        createdAt: Date.now()
      });

      await writeJSON(FAVORITES_DB, {
        favorites
      });

      res.json({
        success: true,
        message: "Ditambahkan ke favorit"
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

app.get(
  "/api/favorites",
  requireLogin,
  async (req, res) => {
    try {
      const favDB = await readJSON(FAVORITES_DB);
      const productDB = await readJSON(PRODUCTS_DB);

      const favorites = favDB.favorites || [];
      const products = productDB.products || [];

      const userFavorites = favorites
        .filter(
          f =>
            f.userId === req.session.userId
        )
        .map(f =>
          products.find(
            p => p.id === f.productId
          )
        )
        .filter(Boolean);

      res.json({
        success: true,
        products: userFavorites
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

app.delete(
  "/api/favorites/:productId",
  requireLogin,
  async (req, res) => {
    try {
      const productId = Number(req.params.productId);

      const favDB = await readJSON(FAVORITES_DB);

      let favorites =
        favDB.favorites || [];

      favorites = favorites.filter(
        f =>
          !(
            f.userId ===
              req.session.userId &&
            f.productId === productId
          )
      );

      await writeJSON(FAVORITES_DB, {
        favorites
      });

      res.json({
        success: true,
        message: "Favorit dihapus"
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   CHAT SEND
========================= */

app.post(
  "/api/chat/send",
  requireLogin,
  async (req, res) => {
    try {
      const {
        productId,
        toUserId,
        message
      } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false
        });
      }

      const chatDB =
        await readJSON(CHATS_DB);

      const chats =
        chatDB.chats || [];

      const newChat = {
        id: generateId(),
        productId:
          Number(productId),
        fromUserId:
          req.session.userId,
        toUserId:
          Number(toUserId),
        message,
        image: "",
        read: false,
        createdAt: Date.now()
      };

      chats.push(newChat);

      await writeJSON(CHATS_DB, {
        chats
      });

      res.json({
        success: true,
        chat: newChat
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   GET CHAT ROOM
========================= */

app.get(
  "/api/chat/:userId",
  requireLogin,
  async (req, res) => {
    try {
      const targetUserId =
        Number(req.params.userId);

      const chatDB =
        await readJSON(CHATS_DB);

      const chats =
        chatDB.chats || [];

      const messages =
        chats.filter(
          c =>
            (
              c.fromUserId ===
                req.session.userId &&
              c.toUserId ===
                targetUserId
            ) ||
            (
              c.fromUserId ===
                targetUserId &&
              c.toUserId ===
                req.session.userId
            )
        );

      messages.sort(
        (a, b) =>
          a.createdAt -
          b.createdAt
      );

      res.json({
        success: true,
        messages
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   INBOX
========================= */

app.get(
  "/api/inbox",
  requireLogin,
  async (req, res) => {
    try {
      const chatDB =
        await readJSON(CHATS_DB);

      const userDB =
        await readJSON(USERS_DB);

      const chats =
        chatDB.chats || [];

      const users =
        userDB.users || [];

      const inboxMap =
        new Map();

      chats.forEach(chat => {
        if (
          chat.fromUserId ===
            req.session.userId ||
          chat.toUserId ===
            req.session.userId
        ) {
          const otherUserId =
            chat.fromUserId ===
            req.session.userId
              ? chat.toUserId
              : chat.fromUserId;

          inboxMap.set(
            otherUserId,
            chat
          );
        }
      });

      const inbox =
        Array.from(
          inboxMap.values()
        ).map(chat => {
          const otherUser =
            users.find(
              u =>
                u.id ===
                (
                  chat.fromUserId ===
                  req.session.userId
                    ? chat.toUserId
                    : chat.fromUserId
                )
            );

          return {
            chat,
            user: otherUser
          };
        });

      res.json({
        success: true,
        inbox
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   NOTIFICATIONS
========================= */

app.get(
  "/api/notifications",
  requireLogin,
  async (req, res) => {
    try {
      const db =
        await readJSON(
          NOTIFICATIONS_DB
        );

      const notifications =
        db.notifications || [];

      const result =
        notifications.filter(
          n =>
            n.userId ===
            req.session.userId
        );

      result.sort(
        (a, b) =>
          b.createdAt -
          a.createdAt
      );

      res.json({
        success: true,
        notifications: result
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

app.post(
  "/api/notifications/read/:id",
  requireLogin,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const db =
        await readJSON(
          NOTIFICATIONS_DB
        );

      const notifications =
        db.notifications || [];

      const notif =
        notifications.find(
          n => n.id === id
        );

      if (notif) {
        notif.read = true;

        await writeJSON(
          NOTIFICATIONS_DB,
          {
            notifications
          }
        );
      }

      res.json({
        success: true
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   PROFILE
========================= */

const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(
      null,
      path.join(
        __dirname,
        "uploads/profiles"
      )
    );
  },

  filename: function (req, file, cb) {
    const ext = path.extname(
      file.originalname
    );

    cb(
      null,
      Date.now() +
        "-" +
        Math.floor(
          Math.random() * 99999
        ) +
        ext
    );
  }
});

const uploadProfile = multer({
  storage: profileStorage
});

app.get(
  "/api/profile",
  requireLogin,
  async (req, res) => {
    try {
      const db =
        await readJSON(USERS_DB);

      const users =
        db.users || [];

      const user =
        users.find(
          u =>
            u.id ===
            req.session.userId
        );

      if (!user) {
        return res.status(404).json({
          success: false
        });
      }

      res.json({
        success: true,
        user
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   UPDATE PROFILE
========================= */

app.put(
  "/api/profile",
  requireLogin,
  async (req, res) => {
    try {
      const db =
        await readJSON(USERS_DB);

      const users =
        db.users || [];

      const user =
        users.find(
          u =>
            u.id ===
            req.session.userId
        );

      if (!user) {
        return res.status(404).json({
          success: false
        });
      }

      user.username =
        req.body.username ||
        user.username;

      user.bio =
        req.body.bio ||
        user.bio;

      user.city =
        req.body.city ||
        user.city;

      await writeJSON(
        USERS_DB,
        { users }
      );

      res.json({
        success: true,
        message:
          "Profil berhasil diperbarui"
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   UPLOAD AVATAR
========================= */

app.post(
  "/api/profile/avatar",
  requireLogin,
  uploadProfile.single(
    "avatar"
  ),
  async (req, res) => {
    try {
      const db =
        await readJSON(USERS_DB);

      const users =
        db.users || [];

      const user =
        users.find(
          u =>
            u.id ===
            req.session.userId
        );

      if (!user) {
        return res.status(404).json({
          success: false
        });
      }

      user.avatar =
        "/uploads/profiles/" +
        req.file.filename;

      await writeJSON(
        USERS_DB,
        { users }
      );

      res.json({
        success: true,
        avatar: user.avatar
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   FOLLOW SELLER
========================= */

app.post(
  "/api/follow/:sellerId",
  requireLogin,
  async (req, res) => {
    try {
      const sellerId =
        Number(
          req.params.sellerId
        );

      const db =
        await readJSON(
          FOLLOWS_DB
        );

      const follows =
        db.follows || [];

      const exists =
        follows.find(
          f =>
            f.followerId ===
              req.session
                .userId &&
            f.sellerId ===
              sellerId
        );

      if (exists) {
        return res.json({
          success: false,
          message:
            "Sudah follow"
        });
      }

      follows.push({
        followerId:
          req.session.userId,
        sellerId,
        createdAt:
          Date.now()
      });

      await writeJSON(
        FOLLOWS_DB,
        {
          follows
        }
      );

      res.json({
        success: true
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   REVIEW SELLER
========================= */

app.post(
  "/api/review",
  requireLogin,
  async (req, res) => {
    try {
      const {
        sellerId,
        rating,
        comment
      } = req.body;

      const db =
        await readJSON(
          REVIEWS_DB
        );

      const reviews =
        db.reviews || [];

      reviews.push({
        id: generateId(),
        sellerId:
          Number(sellerId),
        buyerId:
          req.session.userId,
        rating:
          Number(rating),
        comment:
          comment || "",
        createdAt:
          Date.now()
      });

      await writeJSON(
        REVIEWS_DB,
        {
          reviews
        }
      );

      res.json({
        success: true
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   SELLER PROFILE
========================= */

app.get(
  "/api/seller/:id",
  async (req, res) => {
    try {
      const sellerId =
        Number(
          req.params.id
        );

      const userDB =
        await readJSON(
          USERS_DB
        );

      const productDB =
        await readJSON(
          PRODUCTS_DB
        );

      const reviewDB =
        await readJSON(
          REVIEWS_DB
        );

      const users =
        userDB.users || [];

      const products =
        productDB.products ||
        [];

      const reviews =
        reviewDB.reviews || [];

      const seller =
        users.find(
          u =>
            u.id ===
            sellerId
        );

      if (!seller) {
        return res.status(404).json({
          success: false
        });
      }

      const sellerProducts =
        products.filter(
          p =>
            p.sellerId ===
            sellerId
        );

      const sellerReviews =
        reviews.filter(
          r =>
            r.sellerId ===
            sellerId
        );

      res.json({
        success: true,
        seller,
        products:
          sellerProducts,
        reviews:
          sellerReviews
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   VERIFICATION
========================= */

const verificationStorage =
  multer.diskStorage({
    destination:
      function (
        req,
        file,
        cb
      ) {
        cb(
          null,
          path.join(
            __dirname,
            "uploads/profiles"
          )
        );
      },

    filename:
      function (
        req,
        file,
        cb
      ) {
        cb(
          null,
          Date.now() +
            "-" +
            file.originalname
        );
      }
  });

const uploadVerification =
  multer({
    storage:
      verificationStorage
  });

app.post(
  "/api/verification",
  requireLogin,
  uploadVerification.fields([
    {
      name: "ktpImage",
      maxCount: 1
    },
    {
      name: "selfieImage",
      maxCount: 1
    }
  ]),
  async (req, res) => {
    try {
      const db =
        await readJSON(
          VERIFICATIONS_DB
        );

      const verifications =
        db.verifications ||
        [];

      verifications.push({
        id: generateId(),
        userId:
          req.session.userId,
        ktpImage:
          "/uploads/profiles/" +
          req.files
            .ktpImage[0]
            .filename,
        selfieImage:
          "/uploads/profiles/" +
          req.files
            .selfieImage[0]
            .filename,
        status:
          "pending",
        createdAt:
          Date.now()
      });

      await writeJSON(
        VERIFICATIONS_DB,
        {
          verifications
        }
      );

      res.json({
        success: true,
        message:
          "Verifikasi dikirim"
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   REPORT
========================= */

app.post(
  "/api/report",
  requireLogin,
  async (req, res) => {
    try {
      const {
        targetType,
        targetId,
        reason
      } = req.body;

      const db =
        await readJSON(
          REPORTS_DB
        );

      const reports =
        db.reports || [];

      reports.push({
        id: generateId(),
        reporterId:
          req.session.userId,
        targetType,
        targetId,
        reason,
        createdAt:
          Date.now()
      });

      await writeJSON(
        REPORTS_DB,
        {
          reports
        }
      );

      res.json({
        success: true,
        message:
          "Laporan berhasil dikirim"
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   MY ADS
========================= */

app.get(
  "/api/my-ads",
  requireLogin,
  async (req, res) => {
    try {
      const db =
        await readJSON(
          PRODUCTS_DB
        );

      const products =
        db.products || [];

      const myAds =
        products.filter(
          p =>
            p.sellerId ===
            req.session.userId
        );

      res.json({
        success: true,
        products: myAds
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   ORDERS
========================= */

app.get(
  "/api/orders",
  requireLogin,
  async (req, res) => {
    try {
      const db =
        await readJSON(
          ORDERS_DB
        );

      const orders =
        db.orders || [];

      const result =
        orders.filter(
          order =>
            order.buyerId ===
              req.session
                .userId ||
            order.sellerId ===
              req.session
                .userId
        );

      res.json({
        success: true,
        orders: result
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   HOME FEED
========================= */

app.get(
  "/api/home",
  async (req, res) => {
    try {
      const productDB =
        await readJSON(
          PRODUCTS_DB
        );

      const products =
        productDB.products ||
        [];

      const latest =
        products
          .filter(
            p =>
              p.status ===
              "active"
          )
          .sort(
            (a, b) =>
              b.createdAt -
              a.createdAt
          )
          .slice(0, 20);

      res.json({
        success: true,
        latest
      });

    } catch (err) {
      res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================
   VIEW ROUTES
========================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "views",
      "splash.html"
    )
  );
});

app.get(
  "/login",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "login.html"
      )
    );
  }
);

app.get(
  "/register",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "register.html"
      )
    );
  }
);

app.get(
  "/home",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "home.html"
      )
    );
  }
);

app.get(
  "/product",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "product.html"
      )
    );
  }
);

app.get(
  "/add-product",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "add-product.html"
      )
    );
  }
);

app.get(
  "/favorites",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "favorites.html"
      )
    );
  }
);

app.get(
  "/notifications",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "notifications.html"
      )
    );
  }
);

app.get(
  "/profile",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "profile.html"
      )
    );
  }
);

app.get(
  "/edit-profile",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "edit-profile.html"
      )
    );
  }
);

app.get(
  "/seller-profile",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "seller-profile.html"
      )
    );
  }
);

app.get(
  "/chat",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "chat.html"
      )
    );
  }
);

app.get(
  "/inbox",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "inbox.html"
      )
    );
  }
);

app.get(
  "/my-ads",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "my-ads.html"
      )
    );
  }
);

app.get(
  "/orders",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "views",
        "orders.html"
      )
    );
  }
);

/* =========================
   404
========================= */

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      message:
        "Halaman tidak ditemukan"
    });
  }
);

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(
    `MarketplaceID running on port ${PORT}`
  );
});
