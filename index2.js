const{ MongoClient} = require ('mongodb');

const drivers = [
    {
        name:"Jannah",
        vehicleType: "Sedan",
        isAvailable: true,
        rating: 4.8
    },
    {
        name: "Ayuni",
        vehicleType: "SUV",
        isAvailable: false,
        rating: 4.5
    }
];

console.log(drivers);

async function main(){
    const uri="mongodb://localhost:27017"
    const client = new MongoClient(uri)

    try{
        await client.connect();
        const db = client.db("testDB");

        const driversCollection = db.collection("drivers");

        drivers.forEach(async (driver)=> {
            const result = await driversCollection.insertOne(driver);
            console.log(`New driver created with result: ${result.insertedId}`);
        });

        const updateResult = await db.collection('drivers').updateMany(
            { name: "Jannah" },
            { $inc: { rating: 0.1 } }
        );
        console.log(`Driver updated with result: ${updateResult.modifiedCount}`);

        const deleteResult = await db.collection('drivers').deleteMany({ isAvailable: true })
        console.log(`Driver deleted with result: ${deleteResult.deletedCount}`);

    } finally {
        await client.close();
    }  
}
main();
