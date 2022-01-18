const cpen400a = require('./cpen400a-tester.js');
const path = require('path');
const fs = require('fs');
const express = require('express');
const ws = require('ws');
const Database = require('./Database.js');
const server = ws.Server;
const broker = new server({
    port:8000
});
var db = new Database("mongodb://localhost:27017","cpen400a-messenger");
const messageBlockSize = 10;

function logRequest(req, res, next){
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');

// express app
let app = express();

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug

var messages = {};
db.getRooms().then((result)=>{
    for(i in result)
     messages[result[i]._id] = [];     
},(error)=>console.log(error));
 
console.log(messages); 

broker.on('connection',function(w){
    w.on('message',function(d){
       var data = JSON.parse(d);
       if(data.text.replace(/\s+/g,"")!=""){
        messageObj = {};
        messageObj.username = data.username;
        messageObj.text = data.text;
        messages[data.roomId].push(messageObj);
       }
       if(messages[data.roomId].length==messageBlockSize){
          conversationObj = {};
          conversationObj.room_id = data.roomId;
          conversationObj.timestamp = Date.now();
          conversationObj.messages = [];
          messages[data.roomId].forEach(function(item){
            conversationObj.messages.push(item);
          });
          db.addConversation(conversationObj);
          messages[data.roomId] = [];
       }
       broker.clients.forEach(function(client){
           if(client != w && client.readyState==1){
               client.send(d);
           }
       });
    });
  });
app.get('/chat/:room_id/messages',(req,res)=>{
  db.getLastConversation(req.params.room_id,req.query.before).then((conversation)=>{
      if(conversation!=null){
        res.send(conversation);
      }
      else
        res.status(404).json("No such conversation.");
  })
})

app.get('/chat/:room_id',(req,res)=>{
    db.getRoom(req.params.room_id).then((room)=>{
        if(room!=null)
           res.send(room);
       else
          res.status(404).json("Room"+req.params.room_id+"was not found.")
        })
 })

app.route('/chat')
.get(function(req,res){
    db.getRooms().then(function(chatrooms){
     for(i in chatrooms){
        chatrooms[i].messages = messages[chatrooms[i]._id];
     }
        res.send(chatrooms);
    },(error)=>console.log(error));
})
.post(function(req,res){
      if(req.body.image==null)
         req.body.image='assets/everyone-icon.png';
      db.addRoom(req.body).then(function (room) {
        messages[room._id]=[];
        res.status(200).json({_id:room._id,name:room.name,image:room.image});
      },(error)=>res.status(400).json("Error: Please provide a name."));
})
// serve static files (client-side)
app.use('/', express.static(clientApp, { extensions: ['html'] }));
app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

cpen400a.connect('http://35.183.65.155/cpen400a/test-a4-server.js');
cpen400a.export(__filename, {app, db, messages, messageBlockSize,broker});