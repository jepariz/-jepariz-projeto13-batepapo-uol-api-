import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const app = express();

//SCHEMAS ------------------------------------------------------------------------------------

const participantSchema = joi.object({
  name: joi.string().required().min(1)
})

const messagesSchema = joi.object({
  to: joi.string().min(1),
  text: joi.string().min(1).required().trim(),
  type: joi.string().valid("message", "private_message", "status"),
});

const editMessageSchema = joi.object({
  to: joi.string().min(1),
  text: joi.string().min(1).required().trim(),
  type: joi.string().valid("message", "private_message"),
})

//--------------------------------------------------------------------------------------------

dotenv.config();
dayjs().format();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db("batepapouol");
} catch (err) {
  console.log(err);
}

//ROTAS PARTICIPANTS --------------------------------------------------------------------

const participantsCollection = db.collection("participants");

app.post("/participants", async (req, res) => {
  const name = req.body.name;
 

  try {
    const validation = participantSchema.validateAsync({name: name});

    if(validation.error) {
      res.status(422);
      return
    }

    const activeParticipants = await participantsCollection.findOne({
      name: name,
    });

    if (activeParticipants) {
      res.status(409).send("Nome de usuário já cadastrado");
      return;
    }

    const newParticipant = await participantsCollection.insertOne({
      name: name,
      lastStatus: Date.now(),
    });

    const message = await messagesCollection.insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.status(201).send("Usuário cadastrado com sucesso!");
  } catch (err) {
    console.log(err);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await participantsCollection.find().toArray();
    res.send(participants);
  } catch (err) {
    console.log(err);
  }
});

//ROTAS MESSAGES ------------------------------------------------------------------------

const messagesCollection = db.collection("messages");

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;

  const validation = messagesSchema.validate(req.body, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((e) => e.message);
    return res.status(422).send(errors);
  }

  const messageFrom = participantsCollection.findOne({ name: from });

  if (!messageFrom) {
    return res.status(422).send("Remetente não encontrado");
  }

  const currentTime = dayjs().format("HH:mm:ss");

  try {
    await messagesCollection.insertOne({
      to: to,
      text: text,
      type: type,
      from: from,
      time: currentTime,
    });
    res.status(201).send("Mensagem cadastrada com sucesso");
  } catch (err) {
    console.log(err);
  }
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const user = req.headers.user;

  try {
    const messages = await messagesCollection
      .find({
        $or: [
          { type: "message" },
          { type: "status" },
          { type: "private_message", to: user },
          { type: "private_message", from: user },
        ],
      })
      .toArray();

    if (!limit) {
      res.send(messages);
    }

    if (limit) {
      const lastMessages = messages.slice(messages.length - limit);
      res.send(lastMessages);
    }
  } catch (err) {
    console.log(err);
  }
});

app.delete("/messages/:ID_DA_MENSAGEM", async (req, res) => {

  const user = req.headers.user
  const id = req.params.ID_DA_MENSAGEM

  console.log(id)

  try{

    const messageFound = await messagesCollection.findOne({_id: new ObjectId(id)})

    if(!messageFound){
      res.status(404).send("Mensagem não encontrada")
      return
    }
    
  
    if(messageFound.from !== user){
      res.status(401).send("Mensagem de outro usuário")
      return
    }
  
  await messagesCollection.deleteOne({_id: new ObjectId(id)})
  res.status(200).send("Mensagem deletada com sucesso")

  }catch (err){
    console.log(err)
  }

})

app.put("/messages/:ID_DA_MENSAGEM", async (req, res) =>{

const {to, text, type} = req.body
const from = req.headers.user
const user = req.headers.user
const id = req.params.ID_DA_MENSAGEM

try{

  const validation = editMessageSchema.validateAsync({to: to, text: text, type: type}, {abortEarly: false})

  if(validation.error){
    const errors = validation.error.details.map((e) => e.message);
    return res.status(422).send(errors);
  }
  
  const messageFrom = await participantsCollection.findOne({ name: from });
  
  if (!messageFrom) {
    return res.status(422).send("Mensagem de outro usuário");
  }
  
  const messageFound = await messagesCollection.findOne({_id: new ObjectId(id)})
  
  if(!messageFound){
    res.status(404).send("Mensagem não encontrada")
    return
  }
  
  if(messageFound.from !== user){
    res.status(401).send("Mensagem de outro usuário")
    return
  }

  await messagesCollection.updateOne({_id: new ObjectId(id)}, {$set: req.body})
  res.sendStatus(200)

}catch (err){
  console.log(err)
}

})

//ROTA STATUS ----------------------------------------------------------------------------

app.post("/status", async (req, res) => {
  const { user } = req.headers;

  try {
    const status = await participantsCollection.findOne({
      name: user,
    });

    if (!status) {
      res.status(404).send("Usuário não encontrado");
    }

    participantsCollection.updateOne(
      { lastStatus: status.lastStatus },
      { $set: { lastStatus: Date.now() } }
    );
    res.status(200).send("status atualizado!");
  } catch (err) {
    console.log(err);
  }
});

setInterval(async () => {
  const participants = await participantsCollection.find().toArray();
  const participantsOffline = participants.filter(
    (part) => part.lastStatus < Date.now() - 10000
  );

  try {
    await participantsCollection.deleteMany({
      lastStatus: { $lt: Date.now() - 10000 },
    });

    participantsOffline.forEach(async (part) => {
      await messagesCollection.insertOne({
        from: part.name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
      });
    });
  } catch (err) {
    console.error(err);
  }
}, 15000);

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
