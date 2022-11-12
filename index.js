import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";



const app = express();

//SCHEMAS ------------------------------------------------------------------------------------

const participantSchema = joi.object({
    name: joi.string().min(1).required(),
  });

const messagesSchema = joi.object({
  to: joi.string().min(1),
  text: joi.string().min(1),
  type: joi.string().valid('message', 'private_message')
})

//--------------------------------------------------------------------------------------------

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

//ROTAS PARTICIPANTS --------------------------------------------------------------------

const participantsCollection = db.collection("participants")

app.post("/participants", async (req, res) => {
  const name = req.body.name;

  const validation = participantSchema.validate(name);

  if (validation.error) {
    res.status(422);
  }

  try {

    const activeParticipants = await participantsCollection.findOne({name: name});

    if(activeParticipants){
        res.status(409).send("Nome de usuário já cadastrado")
        return
    }


        const newParticipant = await participantsCollection.insertOne({ name: req.body.name, lastStatus: Date.now() });
      
         const message = await db
           .collection("status")
           .insertOne({
             from: newParticipant,
             to: "Todos",
             text: "entra na sala...",
             type: "status",
             time: dayjs().format("HH:mm:ss"),
           });
         res.status(201)
    } catch (err) {
    console.log(err);
  }
});

app.get("/participants", async (req, res) => {
    
    try{
        const participants = await db.collection("participants").find().toArray()
        res.send(participants)
    }catch (err){
        console.log(err)
    }
})

//ROTAS MESSAGES ------------------------------------------------------------------------

const messagesCollection = db.collection("messages")

app.post("/messages", async (req, res) => {

const {to, text, type} = req.body
const from = req.headers.user

const validation = messagesSchema.validate(req.body, {abortEarly:false})

if(validation.error){
  const errors = validation.error.details.map((e) => e.message)
  return res.status(422).send(errors)
}

const messageFrom = await participantsCollection.findOne({name: from})

if(!messageFrom){
 return res.status(422).send("Remetente não encontrado")
}

const currentTime = dayjs().format("HH:mm:ss")
console.log(currentTime)

try{
await messagesCollection.insertOne({to:to, text: text, type: type, from: from, time: currentTime})
res.status(201).send("Mensagem cadastrada com sucesso")
} catch (err){
  console.log(err)
}

})

app.get("/messages", async (req, res) => {





} )




app.listen(5000, () => {
  console.log("Server running on port 5000");
});


