const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express')
const app = express()
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()
app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion } = require('mongodb');
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

        //================ GET ALL PRINT MASTERS =================
        app.get('/print-masters', async (req, res) => {
            const result = await collectionPrintMaster.find().toArray()
            res.send(result);
        })

        //================ post print master =================
        



        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);
