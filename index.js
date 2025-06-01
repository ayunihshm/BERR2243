const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const port = 3200;

const app = express();
app.use(express.json());

let db;

async function connectToMongoDB() {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB!');
    db = client.db('recipeDB');
  } catch (err) {
    console.error('Error:', err);
  }
}
connectToMongoDB();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const bcrypt = require('bcrypt');
const saltRounds = 10;

app.post('/users', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
    const user = { ...req.body, password: hashedPassword };
    await db.collection('users').insertOne(user);
    res.status(201).json({ message: "User created" });
  } catch (err) {
    res.status(400).json({ error: "Registration failed" });
  }
});

const jwt = require('jsonwebtoken');
app.post('/auth/login', async (req, res) => {
  const user = await db.collection('users').findOne({ email: req.body.email 
  });
  if (!user || !(await bcrypt.compare(req.body.password, user.password))){
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
  res.status(200).json({ token });
})

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if(!token) return res.status(401).json({ error: "Unauthorized"});

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: "Forbidden" });
  next();
};

app.delete('/admin/users/:id', authenticate, authorize(['admin']), async (req, res) => {
  console.log("admin only");
  res.status(200).send("admin access");
});