const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express')
const app = express();
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

dotenv.config()
app.use(cors())
app.use(express.json())

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
})


// multer setup
const upload = multer({
    dest: 'uploads/'
})

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
// const multer = require("multer");
const uri = process.env.PRINT_MASTER_CONNECTION;
const port = process.env.PORT;


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


const jwks = createRemoteJWKSet(new URL(`http://localhost:3000/api/auth/jwks`));


const verifyToken = async (req, res, next) => {
    const token = req?.headers?.authorization;
    console.log('token with headers', token);

    if (!token) {
        return res.status(401).send({ message: 'Unauthorized' });
    }

    const tokenParts = token?.split(' ')[1];
    console.log('token parts', tokenParts);

    if (!tokenParts) {
        return res.status(401).send({ message: 'Unauthorized' });
    }


    try {
        const { payload } = await jwtVerify(tokenParts, jwks)
        req.user = payload;
        console.log('payload', payload);
        next();
    }
    catch (error) {
        console.log('token is not verify', error);
        return res.status(401).send({ message: 'Unauthorized' });
    }


}


async function run() {
    try {
        // await client.connect();

        // Connection to the 'print-master' database
        const printMasterDb = client.db('print-master');
        const collectionPrintMaster = printMasterDb.collection('print-master'); // Note: In your screenshot, this collection is actually called 'users'
        const collectionUploads = printMasterDb.collection('uploads');

        // Connection to the 'userInfo' database
        const userInfoDb = client.db('userInfo');
        const usersCollection = userInfoDb.collection('user');

        app.get("/user/:email", async (req, res) => {
            try {
                console.log("ROUTE HIT:", req.params.email);
                const emailStr = decodeURIComponent(req.params.email).trim();
                // Use a regex with the 'i' flag for case-insensitivity
                const user = await usersCollection.findOne({
                    email: { $regex: `^${emailStr}$`, $options: 'i' }
                });

                if (!user) {
                    return res.status(404).send({ message: "User not found" });
                }

                res.send(user);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Internal server error" });
            }
        });


        //================ GET ALL PRINT MASTERS =================
        app.get('/uploads', verifyToken, async (req, res) => {
            const result = await collectionUploads.find().toArray()
            res.send(result);
        })


        //================= GET ONLY ONE USER ALL POST =================
        app.get('/uploads/user/:id', async (req, res) => {
            const { id } = req.params;
            const result = await collectionUploads.find({ id: id }).toArray();
            res.send(result);
        });

        //================ GET ONE PRINT MASTER POST =================
        app.get('/upload/:id', async (req, res) => {
            const { id } = req.params;
            const result = await collectionUploads.findOne({ _id: new ObjectId(id) });
            res.send(result);
        })



        //================ upload print master =================
        app.post('/upload', upload.single('image'), async (req, res) => {
            const { text, email, id, name, userImage } = req.body;
            const result = await cloudinary.uploader.upload(req.file.path);
            const imageUrl = result.secure_url;
            console.log(imageUrl);
            await collectionUploads.insertOne({ image: imageUrl, text, email, id, name, userImage });
            res.send({ success: true, image: imageUrl, text, email, id, name, userImage, });
        })




        //================ server is running =================
        app.get('/', (req, res) => {
            res.send('server is running!');
        })
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})
run().catch(console.dir);
