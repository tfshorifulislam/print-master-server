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

async function run() {
    try {
        await client.connect();

        const db = client.db('print-master')
        const collectionPrintMaster = db.collection('print-master')
        const collectionUploads = db.collection('uploads')

        //================ GET ALL PRINT MASTERS =================
        app.get('/uploads', async (req, res) => {
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
        app.get('/uploads/:id', async (req, res) => {
            const { id } = req.params;
            const result = await collectionUploads.findOne({ _id: new ObjectId(id) });
            res.send(result);
        })



        //================ upload print master =================
        app.post('/upload', upload.single('image'), async (req, res) => {
            const { text, email, id, name } = req.body;
            const result = await cloudinary.uploader.upload(req.file.path);
            const imageUrl = result.secure_url;
            console.log(imageUrl);
            await collectionUploads.insertOne({ image: imageUrl, text, email, id, name });
            res.send({ success: true, image: imageUrl, text, email, id, name });
        })




        //================ server is running =================
        app.get('/', (req, res) => {
            res.send('server is running!');
        })
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})
run().catch(console.dir);
