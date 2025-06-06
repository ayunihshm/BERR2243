const { MongoClient } = require("mongodb");

// Use MongoDB IP address here
const uri = "mongodb://172.24.156.208:27017";
const client = new MongoClient(uri);

async function runCRUD() {
    try {
        await client.connect();
        const db = client.db("testDB"); // You can change the DB name
        const collection = db.collection("users");

        // CREATE
        const createResult = await collection.insertOne({ name: "Alice", age: 25 });
        console.log("Created document:", createResult.insertedId);

        // READ
        const foundUser = await collection.findOne({ name: "Alice" });
        console.log("Read document:", foundUser);

        // UPDATE
        const updateResult = await collection.updateOne({ name: "Alice" }, { $set: { age: 26 } });
        console.log("Updated documents:", updateResult.modifiedCount);

        // DELETE
        //const deleteResult = await collection.deleteOne({ name: "Alice" });
        //console.log("Deleted documents:", deleteResult.deletedCount);

    } catch (err) {
        console.error("Error in CRUD operations:", err);
    } finally {
        await client.close();
    }
}

runCRUD();
