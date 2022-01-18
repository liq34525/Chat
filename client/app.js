window.addEventListener("load",main);
var profile = {username:"Alice"};
var Service = {
  origin: window.location.origin,
  getAllRooms: ()=>{
     return fetch(Service.origin + "/chat")
     .then((response)=>{
       if (response.ok)
          return response.json();
       else
          return response.text().then((text) => { throw new Error(text);});
 })
},
  addRoom:(data)=>{
   return fetch(Service.origin + "/chat", {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    }).then((response)=>{     
    if (response.ok)
      return response.json();
    else
      return response.text().then((text) => { throw new Error(text);});
  })
 },
 getLastConversation:(roomId,before)=>{
   return fetch("/chat/"+roomId+"/messages?before="+before).then((response)=>{
    if(response.ok){
        return response.json();
     }
      else
        return response.text().then((text) => { throw new Error(text);});
   })
 }
}

function* makeConversationLoader(room){
  var lastTime = room.last;
  var conversation;
  while(lastTime>0){
    room.canLoadConversation = false;
    Service.getLastConversation(room.id,lastTime).then((result)=>{
      if(result!=null){
        lastTime = result.timestamp;
        room.canLoadConversation = true;
        room.addConversation(result);
        conversation = result;
      }
      else
        lastTime = 0;
    },(err)=>{console.log(err)});
    yield new Promise((resolve, reject)=>{
      if(room.canLoadConversation)  
        resolve(conversation);
      else
        resolve(null);    
   });
  }
}

function main(){
    let socket = new WebSocket("ws://"+window.location.hostname+":8000");
    var lobby = new Lobby();
    var lobbyView = new LobbyView(lobby);
    var chatView = new ChatView(socket);
    var profileView = new ProfileView();
    renderRoute();
    function renderRoute(){
        var page_content =  document.getElementById("page-view");
        emptyDOM(page_content);
        if(window.location.hash==""||window.location.hash=="#/"){
          page_content.appendChild(lobbyView.elem);
        }else if(window.location.hash.search("#/chat")!=-1){
           var roomID = window.location.hash.slice(7);
           var theRoom = lobby.getRoom(roomID);
           if(theRoom!=null){
             chatView.setRoom(theRoom);
             page_content.appendChild(chatView.elem);
             chatView.chatElem.scrollTop = chatView.chatElem.scrollHeight;
           }
            else{
              window.location='#/';
              renderRoute();
            }
        }else if(window.location.hash=="#/profile"){
           page_content.appendChild(profileView.elem);
    }
 }
 window.addEventListener("popstate",renderRoute);
 function refreshLobby(){
   Service.getAllRooms().then(
     (result)=>{
       for(i in result){
         var find = lobby.getRoom(result[i]._id);
         if(find!=null){
           find.name = result[i].name;
           find.image = result[i].image;
         }
         else{
           lobby.addRoom(result[i]._id,result[i].name,result[i].image,result[i].messages);
         }
       }
     },
     (error)=> console.log(error)
   );
 }
 refreshLobby();
 setInterval(refreshLobby,5000);
 socket.addEventListener("message",function(event){
  var data = JSON.parse(event.data);
  var room = lobby.getRoom(data.roomId);
  room.addMessage(data.username,data.text); 
});
 cpen400a.export(arguments.callee,{renderRoute,lobbyView,chatView,profileView, lobby,refreshLobby, socket});
}

var LobbyView = function(lobby){
      var self = this;
      this.elem = createDOM(
        `<div class="content">
        <ul class = "room-list"></ul>
      <div class="page-control">
         <input type="text" class="text" placeholder="Room title" name="Room name"><button class="button">Creat Room</button>
         </div>
     </div>`);
     this.listElem = this.elem.querySelector(".room-list");
     this.inputElem = this.elem.querySelector(".page-control input");
     this.buttonElem = this.elem.querySelector(".page-control button");
     this.lobby = lobby;
     this.redrawList();
     this.lobby.onNewRoom = function(room){
        var new_node = createDOM(`<li><a href=#/chat/`+room.id+`><img src=`+room.image+` height='50' width='50'/>`+room.name+`</a></li>`);
        self.listElem.appendChild(new_node);
     };
     this.buttonElem.addEventListener("click",function(){
        var text = self.inputElem.value;
        Service.addRoom({name:text})
        .then((result)=>{self.lobby.addRoom(result._id,result.name,result.image)},
          (error)=> console.log(error));
        self.inputElem.value = "";
    });
}
LobbyView.prototype.redrawList = function(){
    emptyDOM(this.listElem);
    var room_list = this.lobby.rooms;
    for(key in room_list){
        var new_node = createDOM(`<li><a href=#/chat/`+room_list[key].id+`><img src=`+room_list[key].image+` height='50' width='50'/>`+room_list[key].name+`</a></li>`);
        this.listElem.appendChild(new_node);
    }
}

var ChatView = function(socket){
    var self = this;
    this.elem = createDOM(
        `<div class="content">
       <h4 class="room-name">Everyone in CPEN400A</h4>
       <div class="message-list"></div>
       <div class="page-control">
           <textarea cols="40" row="3" placeholder="Please type here"></textarea><button class="button">Send</button>
       </div>
   </div>`);
   this.titleElem = this.elem.querySelector(".room-name");
   this.chatElem = this.elem.querySelector(".message-list");
   this.inputElem = this.elem.querySelector(".page-control textarea");
   this.buttonElem = this.elem.querySelector(".page-control button");
   this.room = null;
   this.socket = socket;
   this.buttonElem.addEventListener("click", function(){
       self.sendMessage();
   });
   this.inputElem.addEventListener("keyup",function(event){
      if(!event.shiftKey && event.keyCode==13)
        self.sendMessage();
   });
   this.chatElem.addEventListener("wheel",function(event){
         if(self.chatElem.scrollTop==0&&self.room.canLoadConversation&&event.deltaY<0)
              self.room.getLastConversation.next();
   })
}
ChatView.prototype.sendMessage = function(){
    var text = this.inputElem.value;
    this.room.addMessage(profile.username, text);
    this.socket.send(JSON.stringify({roomId:this.room.id,username:profile.username,text:text}));
    this.inputElem.value = "";
};
ChatView.prototype.setRoom = function(room){
    var self = this;
    this.room = room;
    this.titleElem.innerText = room.name;
    emptyDOM(this.chatElem); 
   for(i in this.room.messages){
      if(this.room.messages[i].username == profile.username){
         var myMessage = createDOM(`<div class="message my-message"></div>`);
         this.chatElem.appendChild(myMessage);
         var new_node1 = createDOM(`<div><span class="message-user">`+this.room.messages[i].username+`</span><span class="message-text">`+this.room.messages[i].text+`</span></div>`);
         myMessage.appendChild(new_node1);
      }
      else{
        var otherMessage = createDOM(`<div class="message"></div>`);
         this.chatElem.appendChild(otherMessage);
         var new_node1 = createDOM(`<div><span class="message-user">`+this.room.messages[i].username+`</span><span class="message-text">`+this.room.messages[i].text+`</span></div>`);
         otherMessage.appendChild(new_node1);
      }
  }
  this.room.onNewMessage = function(message){
    if(message.username == profile.username){
      var myMessage = createDOM(`<div class="message my-message"></div>`);
      self.chatElem.appendChild(myMessage);
       var new_node1 = createDOM(`<div><span class="message-user">`+message.username+`</span><span class="message-text">`+message.text+`</span></div>`);  
       myMessage.appendChild(new_node1);
       self.chatElem.scrollTop = self.chatElem.scrollHeight;
    }else{
       var otherMessage = createDOM(`<div class="message"></div>`);
        self.chatElem.appendChild(otherMessage);
        var new_node1 = createDOM(`<div><span class="message-user">`+message.username+`</span><span class="message-text">`+message.text+`</span></div>`);
        otherMessage.appendChild(new_node1);
    }
  };
  this.room.onFetchConversation = function(conversation){
    var heightBefore= self.chatElem.scrollHeight;
     for(var i=conversation.messages.length-1;i>=0;i--){
       item=conversation.messages[i];
      if(item.username == profile.username){
        var myMessage = createDOM(`<div class="message my-message"></div>`);
        self.chatElem.insertBefore(myMessage,self.chatElem.firstChild);
        var new_node1 = createDOM(`<div><span class="message-user">`+item.username+`</span><span class="message-text">`+item.text+`</span></div>`);  
        myMessage.appendChild(new_node1);
     }else{
         var otherMessage = createDOM(`<div class="message"></div>`);
         self.chatElem.insertBefore(otherMessage,self.chatElem.firstChild);
         var new_node1 = createDOM(`<div><span class="message-user">`+item.username+`</span><span class="message-text">`+item.text+`</span></div>`);
         otherMessage.appendChild(new_node1);
      }
     }
     self.chatElem.scrollTop = self.chatElem.scrollHeight-heightBefore;
  };
 };

var ProfileView = function(){
    this.elem = createDOM(
        `<div class="content">
         <div class="profile-form">
           <div class="form-field">
              <label for="Username">Username:</label>
              <input type="text" name="user-name">
              <br />
              <label for="Password">Password:</label>
              <input type="password" name="user-password">
              <br />
              <label for="Image">Image:</label>
               <img src="./assets/profile-icon.png" height="20" width="20"/>
               <input type="file" name="user-image">
              <br />
              <label for="About">About:</label>
              <textarea name="user-description" style="width:200px;height:80px;"></textarea>
           </div>
       </div>
   <div class="page-control">
      <button class="button">Save</button>
   </div>
  </div> `);
}
var Room = function(id,name,image="assets/everyone-icon.png",messages=[]){
    this.id = id;
    this.name = name;
    this.image = image;
    this.messages = messages;
    this.last = Date.now();
    var generator = makeConversationLoader(this);
    this.getLastConversation = generator;
    this.getLastConversation.next();
    this.canLoadConversation = true;
}
Room.prototype.addMessage = function(username, text){
    if(text.trim() == "")
      return;
    else{
       var new_message = {username:username,text:text};
       this.messages.push(new_message);
       if(typeof(this.onNewMessage) != "undefined")
         this.onNewMessage(new_message);
    }
};
Room.prototype.addConversation = function(conversation){
  for(var i=conversation.messages.length-1;i>=0;i--)
    this.messages.unshift(conversation.messages[i]);
  if(this.onFetchConversation!=undefined)
     this.onFetchConversation(conversation);
};

var Lobby = function(){
    this.rooms = {};
}
Lobby.prototype.getRoom = function(roomId){
    for(key in this.rooms){
      if(key==roomId){
       return this.rooms[key];
      }
    }
};
Lobby.prototype.addRoom = function(id,name,image,messages){
   var addNew = new Room(id,name,image,messages);
   this.rooms[id] = addNew;
    if (typeof(this.onNewRoom) != "undefined"){
        this.onNewRoom(this.rooms[id]);
    }
};

function emptyDOM (elem){
    while (elem.firstChild) elem.removeChild(elem.firstChild);
}

function createDOM (htmlString){
    let template = document.createElement('template');
    htmlString.trim();
    template.innerHTML = htmlString;
    return template.content.firstChild;
}