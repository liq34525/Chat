const e = require('express');
const { MongoClient, ObjectID } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v3.6+ - [API Documentation](http://mongodb.github.io/node-mongodb-native/3.6/api/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen400a app.
 */
function Database(mongoUrl, dbName){
	if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
	this.connected = new Promise((resolve, reject) => {
		MongoClient.connect(
			mongoUrl,
			{
				useNewUrlParser: true
			},
			(err, client) => {
				if (err) reject(err);
				else {
					console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
					resolve(client.db(dbName));
				}
			}
		)
	});
	this.status = () => this.connected.then(
		db => ({ error: null, url: mongoUrl, db: dbName }),
		err => ({ error: err })
	);
}

Database.prototype.getRooms = function(){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: read the chatrooms from `db`
			 * and resolve an array of chatrooms */
			db.collection("chatrooms").find().toArray((err,room)=>{
			   if (err)
				 reject(new Error("Could not find rooms in database."));
				else
				resolve(room);
			});			   
		})
	)
}

Database.prototype.getRoom = function(room_id){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: read the chatroom from `db`
			 * and resolve the result */
			 try{
                resolve(db.collection("chatrooms").findOne({_id:ObjectID(room_id)}))
			 }catch(e){
				 try{resolve(db.collection("chatrooms").findOne({_id:room_id}))}
				 catch(e){resoleve(null)}
			 }
			})
	)
}

Database.prototype.addRoom = function(room){
	return this.connected.then(db => 
		new Promise((resolve, reject) => {
			/* TODO: insert a room in the "chatrooms" collection in `db`
			 * and resolve the newly added room */
			 if(room.name==undefined||room.name=="")
			   reject(new Error("Please provide a name."));
			else{
				var insertObj = {name:room.name,image:room.image};
				if(room._id!=undefined)
				  insertObj[_id] = room._id;
				db.collection("chatrooms").insertOne(insertObj,function (err){
					  if (err)
					   reject(new Error("Failed to add room."));
					   else
					     resolve(insertObj);
				});
			}
		})
	)
}

Database.prototype.getLastConversation = function(room_id, before){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: read a conversation from `db` based on the given arguments
			 * and resolve if found */
			if(before==undefined)
			   before = Date.now(); 
			if(typeof(before)=='string')
			   before = parseInt(before);
		    db.collection("conversations").find({room_id:room_id,timestamp:{$lt:before}}).toArray(function(err,result){
				if (err)
					resoleve(null);
                if(result.length!=0){
				  var latest = result[0].timestamp;
				  var convers = result[0];
				 for (i in result){
					if(result[i].timestamp>latest){
					   latest = result[i].timestamp;
					   convers = result[i];
					}
				}
				  resolve(convers);	
				}
				 else
				   resolve(null);		
		     });
	}))
}

Database.prototype.addConversation = function(conversation){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: insert a conversation in the "conversations" collection in `db`
			 * and resolve the newly added conversation */
			if(conversation.room_id==undefined||conversation.timestamp==undefined||conversation.messages==undefined)
			   reject(new Error("Wrong format of conversation."));
			else{
				db.collection("conversations").insertOne(conversation,function (err){
					  if (err)
					   reject(new Error("Failed to add conversation."));
					   else
					     resolve(conversation);
				});
			}
		})
	)
}

module.exports = Database;
