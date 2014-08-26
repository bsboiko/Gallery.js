## Gallery.js

#### Photo Viewer for the web


#### Note

There is a hard dependency on the [MultitouchController.js](https://github.com/ImagingResearchCenter/MultitouchController.js) toolkit for this library. To view the test cases properly, place `MultitouchController.js` in the `examples/` directory. You can simply run `wget https://raw.githubusercontent.com/ImagingResearchCenter/MultitouchController.js/master/src/MultitouchController.js` in that directory as well.

Depending on the method to create the Gallery, THREE.js might be required. The test files use CDN to get THREE.js, but for your own projects you can select the method of importing THREE.js and MultitouchController.js.

#### Running Locally

Since this using CDNs and images, you'll have a little issue running this locally. A quick fix is to run `python -m SimpleHTTPServer` on the directory with your content. You could of course create an Apache server or whatever you like and that would work just fine.
