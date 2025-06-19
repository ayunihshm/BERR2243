const express = require('express');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');
require('dotenv').config();
console.log("MONGODB_URI:", process.env.MONGODB_URI)
const { authenticate, authorize } = require('./auth');
const { MongoClient, ObjectId } = require('mongodb');
const port = 3300;

const app = express();
app.use(express.json());

let db;

async function connectToMongoDB() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB!');
    db = client.db(process.env.MONGODB_DB);
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
    const { email, password, ...rest } = req.body;

    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const user = {
      email,
      password: hashedPassword,
      ...rest
    };

    const result = await db.collection('users').insertOne(user);
    res.status(201).json({ id: result.insertedId });
  } catch (err) {
    console.error(err); // optional: helpful for debugging
    res.status(400).json({ error: 'Registration failed' });
  }
});

app.post('/auth/register-chef', async (req, res) => {
  try {
    const existing = await db.collection('chefs').findOne({ email: req.body.email });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    // Hash the password
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const chefData = { ...req.body, password: hashedPassword };

    const result = await db.collection('chefs').insertOne(chefData);
    res.status(201).json({ id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Invalid chef registration' });
  }
});


// Fix ratings: convert string IDs to ObjectId in userId and recipeId fields
app.post('/fix-ratings-ids', async (req, res) => {
  try {
    const cursor = db.collection('ratings').find({
      $or: [
        { userId: { $type: "string" } },
        { recipeId: { $type: "string" } }
      ]
    });

    let fixedCount = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const updates = {};
      if (typeof doc.userId === "string") {
        updates.userId = ObjectId(doc.userId);
      }
      if (typeof doc.recipeId === "string") {
        updates.recipeId = ObjectId(doc.recipeId);
      }
      if (Object.keys(updates).length > 0) {
        await db.collection('ratings').updateOne(
          { _id: doc._id },
          { $set: updates }
        );
        fixedCount++;
      }
    }

    res.status(200).json({ message: `Fixed ${fixedCount} ratings documents.` });
  } catch (err) {
    console.error('Error fixing ratings:', err);
    res.status(500).json({ error: 'Failed to fix ratings IDs' });
  }
});


// login
app.post('/auth/login', async (req, res) => {
  try {
    const user = await db.collection('users').findOne({ email: req.body.email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role }, // customize payload as needed
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({ message: 'Login successful', token });
  } catch (err) {
    res.status(500).json({ error: 'Login error' });
  }
});

//change password
app.patch('/auth/change-password', async (req, res) => {
  try {
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.body.userId) });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(req.body.oldPassword, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Old password is incorrect' });

    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.body.userId) },
      { $set: { password: hashedPassword } }
    );

    res.status(200).json({ message: 'Password updated' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error changing password' });
  }
});

// User Profile
//view profile
app.get('/users/:userId', authenticate, async (req, res) => {
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

//update profile
app.patch('/users/:userId', authenticate, async (req, res) => {
  try {
    // Check if the logged-in user matches the target userId OR is admin
    const isSelf = req.user.userId === req.params.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.userId) },
      { $set: req.body }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'User not found or no changes made' });
    }

    res.status(200).json({ message: 'Profile updated' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid profile data' });
  }
});

// Recipes
//post recipe
app.post('/recipes', authenticate, authorize(['chef']), async (req, res) => {
  try {
    if (!req.body.chefId) {
      return res.status(400).json({ error: "chefId is required" });
    }
    const chefObjectId = new ObjectId(req.body.chefId);
    const recipeData = { ...req.body, chefId: chefObjectId, status: 'pending' };
    const result = await db.collection('recipes').insertOne(recipeData);
    res.status(201).json({ id: result.insertedId });
  } catch (err) {
    console.error(err);
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
      userId: new ObjectId(req.params.userId),
      recipeId: new ObjectId(req.body.recipeId),
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
      .find({ userId: new ObjectId(req.params.userId) })
      .toArray();
    res.status(200).json(favorites);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Comments
app.post('/recipes/:recipeId/comments', async (req, res) => {
  try {
    const commentData = {
      recipeId: new ObjectId(req.params.recipeId),
      ...req.body,
    };

    if (commentData.userId) {
      commentData.userId = new ObjectId(commentData.userId);
    }

    const result = await db.collection('comments').insertOne(commentData);
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
        recipeId: new ObjectId(req.params.recipeId),
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
      recipeId: new ObjectId(req.params.recipeId),
      parentId: new ObjectId(req.params.commentId),
    };

    await db.collection('comments').insertOne(reply);
    res.status(201).json({ message: 'Reply added' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Invalid reply data' });
  }
});

// Ratings
app.post('/recipes/:recipeId/ratings', async (req, res) => {
  try {
    const ratingData = {
      recipeId: new ObjectId(req.params.recipeId),
      score: req.body.score,
      // add userId only if present
    };
    if (req.body.userId) ratingData.userId = new ObjectId(req.body.userId);

    await db.collection('ratings').insertOne(ratingData);

    res.status(201).json({ message: 'Rating submitted' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid rating data' });
  }
});

app.get('/api/recipes/:id/ratings', async (req, res) => {
  try {
    const recipeId = req.params.id;

    // Convert recipeId string to ObjectId for query
    const ratings = await db.collection('ratings')
      .find({ recipeId: new ObjectId(recipeId) })
      .toArray();

    res.status(200).json(ratings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get ratings' });
  }
});

// Admin - Approve or Reject
app.patch('/admin/recipes/:id/status', authenticate, authorize(['admin']), async (req, res) => {
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

  app.get('/admin/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
  
  //Reset Passwords
app.patch('/admin/users/:userId/reset-password', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.userId) },
      { $set: { password: hashedPassword } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'User not found or password unchanged' });
    }
    res.status(200).json({ message: 'Password reset successful' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Invalid request to reset password' });
  }
});

// Admin - Delete User
app.delete('/admin/users/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    // If user is not logged in, `authenticate` will return:
    // res.status(401).json({ error: 'Unauthorized' });

    // If user is not an admin, `authorize` will return:
    // res.status(403).json({ error: 'Forbidden' });

    const result = await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      //If no user was found to delete
      return res.status(404).json({ error: 'User not found' });
    }

    //Deletion successful — return 204 No Content
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting user:', err);
    //Server/database error
    res.status(500).json({ error: 'Failed to delete user' });
  }
});



