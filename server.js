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
app.use(express.static(__dirname+'/TEST'))             //make everything in TEST avaliable as URL

app.use(express.static('SVG'))  //make everything in SVG avaliable as URL


app.use('/form', express.static(__dirname + '/index.html'))

app.use(fileUpload())

//add other middleware
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

var FileSchema =  new Schema({ // since 'id' is not a property here, mongoose creates and assigns one for us
    name: String,
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

var file

app.post('/download', (req, res) => {
  file = __dirname + '/SVG/' + req.body.file
  console.dir(file)
  io.emit('file', file)
  res.sendStatus(200)
})

app.get('/download', (req, res) => {
    console.dir(file)
    res.download(file) // Set disposition and send it.
})

app.get('/images', (req, res) => {
  var extension;
  image_list = []
  fs.readdir(__dirname+'/TEST/', (err, files) => {
    files.forEach(file => {

        image_list.push(file)

        console.log(file)
        //image_list.push(file.split('.')[0] + '.svg')

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

                command = 'convert ' + __dirname+'/TEST/'+file + ' ' + __dirname+'/INTER/' + extension[0] + '.pnm';

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
  res.send(image_list)
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

  sampleFile.name = sampleFile.name.replace(/\s+/g, '_')  // Replace spaces with an underscore

  uploadPath = __dirname + '/TEST/' + sampleFile.name;

  sampleFile.mv(uploadPath, function(err) {
    if (err) {
      return res.status(500).send(err);
    }

    res.send('File uploaded to ' + uploadPath);
  });
});

app.post('/messages', async (req, res) => {   // Testing try and catch to catch errors

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

io.on('connection', (socket) => {
    console.log('a user connected')
})

mongoose.connect(dbUrl, { useNewUrlParser: true }, (err) => {
    console.log('mongo db connection', err)
})

var server = http.listen(3000, () => {
    console.log('server is listening on port', server.address().port)
})
