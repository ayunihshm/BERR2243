const{ MongoClient} = require ('mongodb');

const drivers = [
    {
        name:"jannah",
        vechileType: "Sedan",
        isAvailable: true,
        rating: 4.8
    },
    {
        name: "ayuni",
        vechileType: "SUV",
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
        const db= client.db("testDB");

        const driversCollection = db.collection("drivers");

        drivers.forEach(async (driver)=> {
            const result = await driversCollection.insertOne(driver);
            console.log('New driver created with result: ${result}')
        });
    }finally{
        await client.close();
    }
    
}
main();