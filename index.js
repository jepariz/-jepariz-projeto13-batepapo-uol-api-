import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";



const app = express();

const participantSchema = joi.object({
    name: joi.string().min(1).required(),
  });

dotenv.config();

dayjs().format();
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db("batepapouol");
} catch (err) {
  console.log(err);
}

app.post("/participants", async (req, res) => {
  const name = req.body.name;

  const validation = participantSchema.validate(name);


  if (validation.error) {
    res.status(422);
  }


  try {

    const activeParticipants = await db
    .collection("participants")
    .findOne({name: {$eq: name}});

    console.log(activeParticipants)

    if(activeParticipants){
        res.status(409).send("Nome de usuário já cadastrado")
        return
    }

        const newParticipant = db
           .collection("participants")
           .insertOne({ name: req.body.name} ,  {lastStatus: Date.now() });
      
         const message = db
           .collection("status")
           .insert({
             from: newParticipant,
             to: "Todos",
             text: "entra na sala...",
             type: "status",
             time: dayjs("HH:MM:SS"),
           });

         res.status(201).send("Usuário cadastrado")
    } catch (err) {
    console.log(err);
  }

});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});


app.get("/participants", async (req, res) => {
    
    try{
        const participants = await db.collection("participants").find().toArray()
        res.send(participants)
    }catch (err){
        console.log(err)
    }
})