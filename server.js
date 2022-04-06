var express = require('express')
var bodyParser = require('body-parser')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var mongoose = require('mongoose')
var formidable = require('formidable');
var autotrace = require('autotrace');
const path = require('path');
const { exec } = require("child_process");

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

// run autotrace
function convert(dir, out) {
	console.log('input dir = ' + dir);
  console.log('output dir = ' + out);
  autotrace()
		.inputFile(dir)
		.outputFile(out)
		.outputFormat('svg')
		.colorCount(0)			//range(0-256)
		//.backgroundColor(0x000000)
		.despeckleLevel(20)			//range 0-20
		.despeckleTightness(8)  		//range 0-8
		.cornerThreshold(300)		//degrees
		.errorThreshold(1)			//subdivide curve if off by x pixles
		.filterIterations(0)		//smooth curve by x many
		.lineThreshold(0)			//make line if x close to a line
		.cornerSurround(2)			//number of pixels to consider for corner

		.exec(function(err, buffer) {
    		if (!err) {
					console.log('done');
				} else {
          console.log('Autotrace error = ' + err);
        }
			});
}

function asyncOperation ( command, dir, out, callback ) {
  console.log('Command to run ' + command)
	exec(command, (error, stdout, stderr) => {

		if (error) {
			console.log(`error: ${error.message}`);
			return;
		}
		if (stderr) {
			console.log(`stderr: ${stderr}`);
			return;
		}
		console.log('stdout:' + stdout);
		console.log('TEST')
    if (typeof callback === 'function') {
      console.log('callback is a function')
      return callback(dir, out)
    }
	});
}

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
      console.log(file)
      extension = file.split('.')
      if (extension[1] == 'jpg' || extension[1] == 'png' || extension[1] =='svg') {
        image_list.push(file)

        command = 'convert ' + __dirname+'/TEST/'+file + ' ' + __dirname+'/INTER/' + extension[0] + '.pnm';

        dir = __dirname+'/INTER/'+ extension[0] + '.pnm'
        out = __dirname+'/SVG/' + extension[0] + '.svg'

        asyncOperation ( command, dir, out, function ( dir, out, err ) {
          //This code gets run after the async operation gets run

          console.log('Inside Async')
        	convert(dir, out)
        });
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
