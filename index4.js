const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const port = 3100;

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

// User Auth
//register
app.post('/auth/register', async (req, res) => {
  try {
    const result = await db.collection('users').insertOne(req.body);
    res.status(201).json({ id: result.insertedId });
  } catch (err) {
    res.status(400).json({ error: 'Invalid registration data' });
  }
});

//login
app.post('/auth/login', async (req, res) => {
  try {
    const user = await db.collection('users').findOne({
      email: req.body.email,
      password: req.body.password,
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.status(200).json({ message: 'Login successful', user });
  } catch (err) {
    res.status(500).json({ error: 'Login error' });
  }
});

//change password
app.patch('/auth/change-password', async (req, res) => {
  try {
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.body.userId), password: req.body.oldPassword },
      { $set: { password: req.body.newPassword } }
    );
    if (result.modifiedCount === 0)
      return res.status(400).json({ error: 'Password change failed' });
    res.status(200).json({ message: 'Password updated' });
  } catch (err) {
    res.status(400).json({ error: 'Error changing password' });
  }
});

// User Profile
//view profile
app.get('/users/:userId', async (req, res) => {
  try {
    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(req.params.userId) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(400).json({ error: 'Invalid user ID' });
  }
});

//updated profile
app.patch('/users/:userId', async (req, res) => {
  try {
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.userId) },
      { $set: req.body }
    );
    if (result.modifiedCount === 0)
      return res.status(404).json({ error: 'User not found' });
    res.status(200).json({ message: 'Profile updated' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid profile data' });
  }
});

// Recipes
//post recipe
app.post('/recipes', async (req, res) => {
    try {
        const result = await db.collection('recipes').insertOne({ ...req.body, status: 'pending' });
        res.status(201).json({ id: result.insertedId });
    } catch (err) {
        res.status(400).json({ error: "Invalid recipe data" });
    }
});


// update recipe
app.patch('/recipes/:id', async (req, res) => {
  try {
    const result = await db.collection('recipes').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Recipe not found or no changes made' });
    }
    res.status(200).json({ message: 'Recipe updated' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid recipe update data' });
  }
});


//search recipe
app.get('/recipes/search', async (req, res) => {
    try {
      const query = req.query.q || '';
      const results = await db
        .collection('recipes')
        .find({
          status: 'approved',
          title: { $regex: query, $options: 'i' },
        })
        .toArray();
      res.status(200).json(results);
    } catch (err) {
      res.status(500).json({ error: 'Search failed' });
    }
  });
  

//view recipe
app.get('/recipes', async (req, res) => {
  try {
    const recipes = await db
      .collection('recipes')
      .find({ status: 'approved' })
      .toArray();
    res.status(200).json(recipes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

//delete recipe
app.delete('/recipes/:id', async (req, res) => {
  try {
    const result = await db
      .collection('recipes')
      .deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0)
      return res.status(404).json({ error: 'Recipe not found' });
    res.status(200).json({ message: 'Recipe deleted' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid recipe ID' });
  }
});

// Favorites
app.post('/users/:userId/favorites', async (req, res) => {
  try {
    await db.collection('favorites').insertOne({
      userId: req.params.userId,
      recipeId: req.body.recipeId,
    });
    res.status(201).json({ message: 'Recipe added to favorites' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid favorite data' });
  }
});

//view favorites
app.get('/users/:userId/favorites', async (req, res) => {
  try {
    const favorites = await db
      .collection('favorites')
      .find({ userId: req.params.userId })
      .toArray();
    res.status(200).json(favorites);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Comments
app.post('/recipes/:recipeId/comments', async (req, res) => {
  try {
    const result = await db
      .collection('comments')
      .insertOne({ recipeId: req.params.recipeId, ...req.body });
    res.status(201).json({ message: 'Comment added', id: result.insertedId });
  } catch (err) {
    res.status(400).json({ error: 'Invalid comment data' });
  }
});


//delete comment
app.delete('/recipes/:recipeId/comments/:commentId', async (req, res) => {
    try {
      const result = await db.collection('comments').deleteOne({
        _id: new ObjectId(req.params.commentId),
        recipeId: req.params.recipeId,
      });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      res.status(200).json({ message: 'Comment deleted' });
    } catch (err) {
      res.status(400).json({ error: 'Invalid comment ID' });
    }
  });

  //respond comment
app.post('/recipes/:recipeId/comments/:commentId/reply', async (req, res) => {
  try {
    const reply = {
      ...req.body,
      parentId: req.params.commentId,
      recipeId: req.params.recipeId,
    };
    await db.collection('comments').insertOne(reply);
    res.status(201).json({ message: 'Reply added' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid reply data' });
  }
});

// Ratings
app.post('/recipes/:recipeId/ratings', async (req, res) => {
  try {
    await db
      .collection('ratings')
      .insertOne({ recipeId: req.params.recipeId, ...req.body });
    res.status(201).json({ message: 'Rating submitted' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid rating data' });
  }
});

// Admin - Approve or Reject
app.patch('/admin/recipes/:id/status', async (req, res) => {
  try {
    const result = await db.collection('recipes').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: req.body.status } }
    );
    if (result.modifiedCount === 0)
      return res
        .status(404)
        .json({ error: 'Recipe not found or already updated' });
    res.status(200).json({ message: `Recipe ${req.body.status}` });
  } catch (err) {
    res.status(400).json({ error: 'Invalid status update' });
  }
});

// Admin - Manage Users
app.get('/admin/users', async (req, res) => {
    try {
      const users = await db.collection('users').find().toArray();
      res.status(200).json(users);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });
  
  //Reset Passwords
  app.patch('/admin/users/:userId/reset-password', async (req, res) => {
    try {
      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(req.params.userId) },
        { $set: { password: req.body.newPassword } }
      );
      if (result.modifiedCount === 0) {
        return res.status(404).json({ error: 'User not found or password unchanged' });
      }
      res.status(200).json({ message: 'Password reset successful' });
    } catch (err) {
      res.status(400).json({ error: 'Invalid request to reset password' });
    }
  });
