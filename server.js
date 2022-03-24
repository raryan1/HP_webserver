var express = require('express')
var bodyParser = require('body-parser')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var mongoose = require('mongoose')
var formidable = require('formidable');
fs = require('fs');

app.use(express.static(__dirname))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static(__dirname+'/TEST'));             //make everything in TEST avaliable as URL

mongoose.Promise = Promise

var dbUrl = 'mongodb+srv://User:9ecWyqOFmi4F3yK9@learning-node.xa1vy.mongodb.net/learning-node?retryWrites=true&w=majority'

//Define a schema
var Schema = mongoose.Schema;

var MessageSchema =  new Schema({ // since 'id' is not a property here, mongoose creates and assigns one for us
    name: String,
    message: String
})

// Compile model from schema
var Message = mongoose.model('Message', MessageSchema );

app.get('/messages', (req, res) => {
    Message.find({}, (err, messages) => {   // {} is to find all messages
        res.send(messages)
    })
})

var extension;

app.get('/images', (req, res) => {
  image_list = []
  fs.readdir(__dirname+'/TEST/', (err, files) => {
    files.forEach(file => {
      extension = file.split('.').pop()
      if (extension == 'jpg' || extension == 'png' || extension =='svg') {
        image_list.push(file)
        console.log(file);
      }
    });
  res.send(image_list)
  });
})

app.post('/messages', async (req, res) => {   // testing try and catch to catch errors

    try {
        var message = new Message(req.body)

        var savedMessage = await message.save()

        console.log('saved')

        var censored = await Message.findOne({ message: 'badword' })

        if (censored)
            await Message.remove({ _id: censored.id })
        else
            io.emit('message', req.body)

        res.sendStatus(200)
    } catch (error) {
        res.sendStatus(500)
        return console.error(error)
    }
})

app.post('/file', async (req, res) => {

  try {
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
      var oldpath = files.filetoupload.filepath;
      var newpath = __dirname + '/TEST/' + files.filetoupload.originalFilename;
      fs.rename(oldpath, newpath, function (err) {
        if (err) throw err;
        res.write('File uploaded and moved!');
        res.write(files.filetoupload.originalFilename);
        filename = files.filetoupload.originalFilename; // set global filename
        res.end();
      });
    });
  } catch (error) {
    res.sendStatus(500)
    return console.error(error)
  }
})

io.on('connection', (socket) => {
    console.log('a user connected')
})

mongoose.connect(dbUrl, { useNewUrlParser: true }, (err) => {
    console.log('mongo db connection', err)
})

var server = http.listen(3000, () => {
    console.log('server is listening on port', server.address().port)
})
