var autotrace = require('autotrace');
const path = require('path');
const fs = require('fs');

const { execSync } = require("child_process");

var command;

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
          console.log(err);
        }
			});
}

// run command in terminal with callback option
function runCommand(command) {
  execSync(command, (error, stdout, stderr) => {
  	if (error) {
    	console.log(`error: ${error.message}`);
    	return;
  	}
  	if (stderr) {
    	console.log(`stderr: ${stderr}`);
    	return;
  	}
  	console.log(`stdout: ${stdout}`);
	});
}

module.exports = { convert, runCommand };
