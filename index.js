const PORT = process.env.PORT||5000;
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const MongoClient = require('mongodb').MongoClient;
const Canvas = require('canvas')

app.use('/assets', express.static('assets'))

const url='mongodb://localhost:27017/node_chat';

MongoClient.connect(url, function(err,db){
  const database = db.db('node_chat');
  const messagesCollection = database.collection('messages');
  const usersCollection = database.collection('users');
  io.on('connection', function(socket){
    console.log('a user connected');
    socket.on('disconnect', function(){
      console.log('user disconnected');
    });

    socket.on('login form',function(form,option){
        if(form.login!=""&&form.password!=""){
        usersCollection.findOne({'login':form.login,'password':form.password}).then((has)=>{
            if(has!=null){
              socket.emit("Successful validation",option);
              socket.on('chat message', function(msg){
                if(msg!=""){
                  messagesCollection.insertOne({text:form.login + ': ' + msg});
                  io.emit('chat message', form.login + ': '+msg);
                }
              });
              messagesCollection.find().toArray().then((docs)=>{
                socket.emit("chatHistory",docs);
              });
            }else if (option=="ls"){
              socket.emit('needToL/R');
            }else{
              socket.emit('error log',"Invalid login-password combination");
            }
        });
      }
    });





    socket.on('registration form',function(form){

        usersCollection.findOne({$or:[{'login':form.login},{'Email':form.Email}]}).then((has)=>{
          if(has!=null){
            if(has.login==form.login)socket.send('Sorry, but this username is already reserved :(');
            else if(has.Email==form.Email)socket.send('Sorry, but this Email is already reserved :(');
          }else{
            socket.emit("Successful registration");
            let code;
            function createCaptcha() {
              let charsArray =
              "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ@!#$%^&*";
              let lengthOtp = 6;
              let captcha = [];
              for (let i = 0; i < lengthOtp; i++) {
                let index = Math.floor(Math.random() * charsArray.length + 1);
                if (captcha.indexOf(charsArray[index]) == -1)
                  captcha.push(charsArray[index]);
                else i--;
              }
              let canvas = Canvas.createCanvas(110, 50);
              let ctx = canvas.getContext("2d");
              ctx.font = "25px Georgia";
              ctx.strokeText(captcha.join(""), 0, 30);
              code = captcha.join("");
              return(canvas.toDataURL('image/png',1));
            }

            socket.emit('createCaptcha',createCaptcha());
            socket.on('validateCaptcha',function(userCaptcha){
              if(userCaptcha==code){
                 usersCollection.insertOne({login:form.login,
                                            password:form.password,
                                            Email:form.Email});
                socket.emit("Successful validation");
                socket.on('chat message', function(msg){
                  if(msg!=""){
                    messagesCollection.insertOne({text:form.login + ': ' + msg});
                    io.emit('chat message', form.login + ': '+msg);
                  }
                });
                messagesCollection.find().toArray().then((docs)=>{
                  socket.emit("chatHistory",docs);
                });
              }else{
                socket.emit('createCaptcha',createCaptcha());
              }


            });

          }
        });
    })
  });
})
app.get('/', function(req, res){
  res.sendFile(__dirname+'/index.html');
});


http.listen(PORT, function(){
  console.log('listening on *:5000');
});
