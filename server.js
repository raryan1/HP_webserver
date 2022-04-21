// Author: Ryan Earwaker
// Date modified: 19/04/2022
// Node JS Version:
// Description: Server side for the autotrace webserver conversion

// Import required moduels
var express = require('express')
var bodyParser = require('body-parser')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var mongoose = require('mongoose')
var formidable = require('formidable')
var autotrace = require('autotrace')
const path = require('path')
const { exec } = require("child_process")

const fileUpload = require('express-fileupload')
const cors = require('cors')
const morgan = require('morgan')
const _ = require('lodash')

fs = require('fs');

app.use(express.static(__dirname))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static(__dirname+'/INPUT'))            // Make everything in INPUT avaliable as URL
app.use(express.static('SVG'))                        // Make everything in SVG avaliable as URL


app.use('/form', express.static(__dirname + '/index.html'))

app.use(fileUpload())

// Add other middleware
app.use(cors())
app.use(bodyParser.urlencoded({extended: true}))
app.use(morgan('dev'))

mongoose.Promise = Promise

var dbUrl = 'mongodb+srv://User:9ecWyqOFmi4F3yK9@learning-node.xa1vy.mongodb.net/learning-node?retryWrites=true&w=majority'

//Define a schema
var Schema = mongoose.Schema

var MessageSchema =  new Schema({ // since 'id' is not a property here, mongoose creates and assigns one for us
    name: String,
    message: String
})

var FileSchema =  new Schema({    // since 'id' is not a property here, mongoose creates and assigns one for us
    name: String
})

// Compile model from schema
var Message = mongoose.model('Message', MessageSchema )

// Compile model from schema
var File = mongoose.model('File', FileSchema )

// run autotrace
function convert(dir, out) {
	console.log('input dir = ' + dir);
  console.log('output dir = ' + out);
  autotrace()
		.inputFile(dir)
		.outputFile(out)
		.outputFormat('svg')
		.colorCount(0)			    // Range(0-256)
		//.backgroundColor(0x000000)
		.despeckleLevel(20)			// Range 0-20
    .despeckleTightness(8)  // Range 0-8
		.cornerThreshold(300)		// Degrees
		.errorThreshold(1)			// Subdivide curve if off by x pixles
		.filterIterations(0)		// Smooth curve by x many
		.lineThreshold(0)			  // Make line if x close to a line
		.cornerSurround(2)			// Number of pixels to consider for corner

		.exec(function(err, buffer) {
    		if (!err) {
					console.log('done');
				} else {
          console.log('Autotrace error = ' + err);
        }
			});
}

// First the file is converted to pnm format, once that is done without errors
// the callback is returned, the callback in this situation is the autotrace
// 'convert()' function. Callback is necessary to ensure synchronous operation of
// convert followed by run autotrace
function asyncOperation ( command, dir, out, callback ) {
  console.log('Command to run ' + command)

  // Execute specified command in the server terminal
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

    // If the command was successful, check if the callback is a function and execute
    if (typeof callback === 'function') {
      console.log('callback is a function')
      return callback(dir, out)
    }
	});
}

// Find all messages on database and send to client side
app.get('/messages', (req, res) => {
    Message.find({}, (err, messages) => {   // {} is to find all messages
        res.send(messages)
    })
})

var file
// Post the file location to the client side
app.post('/download', (req, res) => {
  file = __dirname + '/SVG/' + req.body.file
  console.dir(file)
  io.emit('file', file) // Emit a socket of the file location, allows the client side download button to navigate to the correct file
  res.sendStatus(200) // Send OK
})
// Get information from the client side
app.get('/download', (req, res) => {
    console.dir(file)
    res.download(file) // Call the express download function with the spesified file location
})

// Get images from server and send them to the slient side
// This function handels all the conversion adn database operation
// First, the image directory is read for all files, each is added to an image list
// and compared to the image list within the database. If a new image is detected,
// convert followed by autotrace is run. Also, the new image is added to the database.
app.get('/images', (req, res) => {
  var extension;
  image_list = []
  fs.readdir(__dirname+'/INPUT/', (err, files) => {
    files.forEach(file => {

        //image_list.push(file)

        console.log(file)
        image_list.push(file.split('.')[0])

        File.find({name: file}, (err, file_name_saved) => {   // Check the database to see if the filename already exists
            console.log(file)
            extension = file.split('.')
            console.log('Checking database for file name')
            console.log(file_name_saved)
            if (extension[1] == 'jpg' || extension[1] == 'png' || extension[1] =='svg') { // Check the files extension

              if (file_name_saved == '') {  // If the file is not in the database run convert and autotrace
                console.log('file not in datebase')
                var file_name = new File({ name: file})
                console.log(file_name)

                file_name.save((err) => { // Ddd new file to database
                    if (err)
                        console.log(err)
                    // If the message was succsessful do below
                    console.log('Success')
                })

                command = 'convert ' + __dirname+'/INPUT/'+file + ' ' + __dirname+'/INTER/' + extension[0] + '.pnm';

                dir = __dirname+'/INTER/'+ extension[0] + '.pnm'
                out = __dirname+'/SVG/' + extension[0] + '.svg'

                asyncOperation ( command, dir, out, function ( dir, out, err ) {
                  // This code gets run after the async operation gets run
                  console.log('Inside Async')
                	convert(dir, out)
                });
              }
          }
        })
    });
  res.send(image_list)  // Send image list to the client side
  });
})

// https://github.com/richardgirges/express-fileupload/tree/master/example
app.post('/upload', function(req, res) {
  let sampleFile;
  let uploadPath;

  if (!req.files || Object.keys(req.files).length === 0) {
    res.status(400).send('No files were uploaded.');
    return;
  }

  console.log('req.files >>>', req.files); // eslint-disable-line

  sampleFile = req.files.sampleFile;

  sampleFile.name = sampleFile.name.replace(/\s+/g, '_')  // Replace spaces with underscores

  uploadPath = __dirname + '/INPUT/' + sampleFile.name;

  sampleFile.mv(uploadPath, function(err) {
    if (err) {
      return res.status(500).send(err);
    }

    res.send('File uploaded to ' + uploadPath);
  });
});
// Get the new message from the client side
app.post('/messages', async (req, res) => {

    try {
        var message = new Message(req.body)     // Create new message object

        // Await as to wait for a promise, in this case the task will
        // wait for the message to be saved to the datebase
        var savedMessage = await message.save()

        console.log('saved')

        var censored = await Message.findOne({ message: 'badword' })  // Check if the message was a badword

        if (censored)
            await Message.remove({ _id: censored.id })  // If badword remove from database
        else
            io.emit('message', req.body)    // Emit the message to the client side assuming no bad word was found

        res.sendStatus(200) // Send OK status
    } catch (error) {
        res.sendStatus(500) // Error status
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
