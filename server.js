const express = require("express");
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.VITE_PAYMENT_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

// Middleware configuration:
const corsConfig = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
};

app.use(cors(corsConfig));
app.use(express.json());


// Server Body Start

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.VITE_USERNAME}:${process.env.VITE_PASSWORD}@cluster0.4in3v8j.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const classes = client.db("winnerEducation").collection("classes");
    const instructors = client.db("winnerEducation").collection("instructors");
    const users = client.db("winnerEducation").collection("users");
    const cart = client.db("winnerEducation").collection("cart");
    const paymentCollection = client
      .db("winnerEducation")
      .collection("payment");
    const notApprovedClasses = client
      .db("winnerEducation")
      .collection("notApproved");

    //Classes API:

    app.get("/allclasses", async (req, res) => {
      const cursor = classes.find();
      const allClasses = await cursor.toArray();
      res.send(allClasses);
    });

    app.get("/instructorclasses", async (req, res) => {
      const { email } = req.query;
      if (!email) {
        res.send([]);
        return;
      }
      const query = { email: email };

      const result = await classes.find(query).toArray();

      res.send(result);
    });

    app.get("/getclass/:courseId", async (req, res) => {
      const courseId = req.params.courseId;

      try {
        const classData = await classes.findOne({
          _id: new ObjectId(courseId),
        });

        if (classData) {
          res.json(classData);
        } else {
          res.status(404).json({ message: "Class not found." });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error retrieving class." });
      }
    });

    // All Instructors
    app.get("/allinstructors", async (req, res) => {
      const cursor = instructors.find();
      const allInstructors = await cursor.toArray();
      res.send(allInstructors);
    });

    // User APIs:

    app.get("/users", async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await users.findOne(query);

      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await users.insertOne(user);
      res.send(result);
    });

    app.patch("/users/admin/:email", async (req, res) => {
      const email = req.params.email;

      const filter = { email: email };

      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await users.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/users/instructor/:email", async (req, res) => {
      const email = req.params.email;

      const filter = { email: email };

      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await users.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.get("/users/admin", async (req, res) => {
      const email = req.query.email;

      // if (req.decoded.user !== email) {
      //   res.send({ admin: false })
      // }

      const query = { email: email };
      const user = await users.findOne(query);

      const result = { admin: user?.role === "admin" };

      res.send(result);
    });

    app.get("/users/instructor", async (req, res) => {
      const email = req.query.email;

      const query = { email: email };
      const user = await users.findOne(query);

      const result = { instructor: user?.role === "instructor" };

      res.send(result);
    });

    app.post("/jwt", async (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.VITE_ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res.send({ token });
    });

    // Cart Related APIs:
    app.post("/cart", async (req, res) => {
      const newItem = req.body;

      const result = await cart.insertOne(newItem);
      res.send(result);
    });

    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cart.deleteOne(query);
      res.send(result);
    });

    app.get("/cart", async (req, res) => {
      const { email } = req.query;
      if (!email) {
        res.send([]);
        return;
      }
      const decodedEmail = req.decoded.user;
      if (decodedEmail !== email) {
        return res
          .status(401)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const result = await cart.find(query).toArray();
      res.send(result);
    });

    // CREATE STRIPE PAYMENT INTENT
    app.post("/create-payment-intent", async (req, res) => {
      const { totalPrice } = req.body;
      const amount = parseInt(totalPrice * 100);

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related api
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      const cartItemIds = payment.cartItems.map((id) => new ObjectId(id));
      const query = {
        _id: { $in: cartItemIds },
      };
      const deleteResult = await cart.deleteMany(query);
      res.send({ insertResult, deleteResult });
    });

    app.get("/payments", async (req, res) => {
      const { email } = req.query;
      if (!email) {
        res.send([]);
        return;
      }
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // Instructor Class Addition API
    app.post("/addclass", async (req, res) => {
      const newCourse = req.body;
      const result = await notApprovedClasses.insertOne(newCourse);
      res.send(result);
    });

    app.get("/instructor-courses/:email", async (req, res) => {
      const instructorEmail = req.params.email;
      try {
        // Fetch courses based on instructor's email
        const instructorCourses = await notApprovedClasses
          .find({
            status: "pending",
            email: instructorEmail,
          })
          .toArray();
        res.send(instructorCourses);
      } catch (error) {
        console.error("Error fetching instructor courses:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch instructor courses",
        });
      }
    });
    app.get("/instructor-courses-for-admin", async (req, res) => {
      try {
        // Fetch courses based on instructor's email
        const instructorCourses = await notApprovedClasses
          .find({
            status: "pending",
          })
          .toArray();
        res.send(instructorCourses);
      } catch (error) {
        console.error("Error fetching instructor courses:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch instructor courses",
        });
      }
    });

    app.get(
      "/instructor-declined-courses/:email",
      async (req, res) => {
        const instructorEmail = req.params.email;
        try {
          // Fetch courses based on instructor's email
          const instructorCourses = await notApprovedClasses
            .find({
              status: "declined",
              email: instructorEmail,
            })
            .toArray();
          res.send(instructorCourses);
        } catch (error) {
          console.error("Error fetching instructor courses:", error);
          res.status(500).send({
            success: false,
            message: "Failed to fetch instructor courses",
          });
        }
      }
    );

    app.post("/approveclass/:id", async (req, res) => {
      const courseId = req.params.id;
      const course = await notApprovedClasses.findOne({
        _id: new ObjectId(courseId),
      });

      // Set status to "approved"
      course.status = "approved";

      // Remove from notApprovedClasses
      await notApprovedClasses.deleteOne({ _id: new ObjectId(courseId) });

      // Insert into "classes" collection
      await classes.insertOne(course);

      res.send({ message: "Course approved and moved to classes" });
    });

    app.post("/declineclass/:id", async (req, res) => {
      const courseId = req.params.id;
      const feedback = req.body.feedback;
      await notApprovedClasses.updateOne(
        { _id: new ObjectId(courseId) },
        { $set: { status: "declined", feedback } }
      );
      res.send({ message: "Course declined" });
    });

    app.put("/updateclass/:id", (req, res) => {
      const courseId = req.params.id;
      const updatedCourse = req.body;

      classes
        .findOneAndUpdate(
          { _id: new ObjectId(courseId) },
          { $set: updatedCourse },
          { returnOriginal: false }
        )
        .then((updatedDoc) => {
          res.json(updatedDoc.value);
        })
        .catch((error) => {
          console.error(error);
          res.status(500).json({ error: "Failed to update class." });
        });
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Server Body End

app.get("/", (req, res) => {
  res.send("Server is Running");
});

app.listen(port, () => {
  console.log(`Listening on ${port}`);
});
