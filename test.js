const { MongoClient } = require("mongodb");

async function test() {
  const uri = "mongodb://localhost:27017"; // replace with your MongoDB URI
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("your_database_name");
    const results = await db.collection("users").aggregate([
      {
        $lookup: {
          from: "comments",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$userId", "$$userId"] }
              }
            }
          ],
          as: "userComments"
        }
      }
    ]).toArray();

    console.log(results);
  } finally {
    await client.close();
  }
}

test().catch(console.error);
