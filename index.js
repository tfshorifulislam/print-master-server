const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
const cloudinary = require("cloudinary").v2;

dotenv.config();

app.use(cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
});

// ================= MONGODB =================
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

const uri = process.env.PRINT_MASTER_CONNECTION;
const port = process.env.PORT || 5000;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

// ================= JWT VERIFY =================
const jwks = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
    const token = req?.headers?.authorization;

    if (!token) {
        return res.status(401).send({ message: "Unauthorized" });
    }

    const tokenParts = token.split(" ")[1];

    if (!tokenParts) {
        return res.status(401).send({ message: "Unauthorized" });
    }

    try {
        const { payload } = await jwtVerify(tokenParts, jwks);
        req.user = payload;
        next();
    } catch (error) {
        return res.status(401).send({ message: "Unauthorized" });
    }
};

// ================= MAIN RUN =================
async function run() {
    try {
        const printMasterDb = client.db("print-master");
        const collectionUploads = printMasterDb.collection("uploads");

        const userInfoDb = client.db("userInfo");
        const usersCollection = userInfoDb.collection("user");

        // ================= HOME =================
        app.get("/", (req, res) => {
            res.send("server is running!");
        });

        // ================= USER =================
        app.get("/user/:email", async (req, res) => {
            try {
                const emailStr = decodeURIComponent(req.params.email).trim();

                const user = await usersCollection.findOne({
                    email: { $regex: `^${emailStr}$`, $options: "i" },
                });

                if (!user) {
                    return res.status(404).send({ message: "User not found" });
                }

                res.send(user);
            } catch (error) {
                res.status(500).send({ message: "Internal server error" });
            }
        });

        // ================= GET ALL POSTS =================
        app.get("/uploads", verifyToken, async (req, res) => {
            const result = await collectionUploads.find().sort({ createdAt: -1 }).toArray();
            res.send(result);
        });

        // ================= USER POSTS =================
        app.get("/uploads/user/:id", verifyToken, async (req, res) => {
            const { id } = req.params;
            const result = await collectionUploads.find({ id }).toArray();
            res.send(result);
        });

        // ================= SINGLE POST =================
        app.get("/uploads/:id", verifyToken, async (req, res) => {
            const { id } = req.params;
            const result = await collectionUploads.findOne({
                _id: new ObjectId(id),
            });
            res.send(result);
        });

        // ================= IMAGE UPLOAD (NO MULTER) =================
        app.post("/upload", verifyToken, async (req, res) => {
            try {
                const { image, text, email, id, name, userImage } = req.body;

                // টেক্সট অথবা ইমেজ যেকোনো একটা থাকলেই পোস্ট করা যাবে
                if (!text && !image) {
                    return res.status(400).send({ message: "Cannot create an empty post" });
                }

                let imageUrl = "";

                // ছবি থাকলে ক্লাউডিনারিতে আপলোড হবে
                if (image) {
                    const result = await cloudinary.uploader.upload(image, {
                        folder: "uploads",
                    });
                    imageUrl = result.secure_url;
                }

                const newPost = {
                    image: imageUrl,
                    text: text || "",
                    email,
                    id,
                    name,
                    userImage,
                    createdAt: new Date(),
                };

                const insertResult = await collectionUploads.insertOne(newPost);

                res.send({
                    success: true,
                    postId: insertResult.insertedId,
                    image: imageUrl,
                });
            } catch (error) {
                res.status(500).send({
                    success: false,
                    message: error.message,
                });
            }
        });

        // ================= DELETE SINGLE POST =================
        app.delete("/uploads/:id", verifyToken, async (req, res) => {
            try {
                const { id } = req.params;

                const result = await collectionUploads.deleteOne({
                    _id: new ObjectId(id),
                });

                if (result.deletedCount === 0) {
                    return res.status(404).send({ message: "Post not found" });
                }

                res.send({
                    success: true,
                    message: "Post deleted successfully",
                });
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Server error" });
            }
        });

        console.log("MongoDB connected successfully");
    } finally {
        
    }
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

run().catch(console.dir);