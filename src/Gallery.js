var GALLERY = GALLERY || {};

/**
 * Creates the main gallery object and the instance variables
 */
GALLERY.Gallery = function(parameters) {

	this.platform = parameters.platform || this.selectPlatform();
	this.container = parameters.container || undefined;
	this.multitouch = parameters.multitouch || true;
	this.width = parameters.width || window.innerWidth;
	this.height = parameters.height || window.innerHeight;

	this.images = []; // empty array of images to start
	this.queue = []; // image queue to hold while loading to preserve order

	this.using_three = (this.platform === "webgl" || this.platform === "canvas") ? true : false; // using three.js?
	this.gallery_mode = false;
	this.focal_image = null; // focal image when zoomed in

	this.GALLERY_DIST = 100; // gap between the images
	this.gallery_width = 0; // end point of the gallery
	this.from_gallery = false; // animation flags
	this.to_gallery = false;
	this.animate_frames = 0; // animation frames currently in play
	this.GALLERY_OFFSET = 50; // animation speed

	this.camera = {};
	this.initGallery(); // set up the gallery viewer

	// create the controller for the gallery
	this.controls = new MULTITOUCH_CONTROLLER.Controller({
		camera: this.camera, 
		container: this.container,
		multitouch: this.multitouch,
	});
}

/*
 * Select a platform
 */
GALLERY.Gallery.prototype.selectPlatform = function() {

	// check for webgl and experimental webgl
	if (window.WebGLRenderingContext && document.createElement('canvas').getContext('experimental-webgl')) {

		return "webgl";
	} else if (window.CanvasRenderingContext2D) { // check for canvas

		return "canvas";
	} else { // worst case

		return "image";
	}
}

/*
 * Create the gallery window
 */
GALLERY.Gallery.prototype.initGallery = function() {

	// using three.js
	if (this.using_three) {

		// boilerplate setup for three.js
		var _scene = new THREE.Scene(),
			_CAMERA_MIN = 75,
			_CAMERA_MAX = 20,
			_renderer = (this.platform === "webgl") ? new THREE.WebGLRenderer() : new THREE.CanvasRenderer(); // webgl or canvas
			
		this.camera = new THREE.PerspectiveCamera(_CAMERA_MIN, this.width / this.height, 0.1, 1000),
		this.camera.position.z = 400; // set the camera back some

		_renderer.setSize(this.width, this.height);
		_renderer.setClearColor(0x000000, 1); // ensure black background

		this.container.appendChild(_renderer.domElement);

		// render the scene
		this.render = function() {
			_renderer.render(_scene, this.camera);
		}

		this.setCamera = function() {

			// check if in gallery, apply bounds for the position
			if (this.gallery_mode) {
				if (this.camera.position.x < 0) {
					this.camera.position.x = 0;
				}

				if (this.camera.position.x > this.gallery_width) {
					this.camera.position.x = this.gallery_width;
				}
				this.camera.position.y = 0;
			}

			// bounds checking the zoom or position.z
			if (this.camera.fov < _CAMERA_MAX) {
				this.camera.fov = _CAMERA_MAX;
			}

			if (this.camera.fov >= _CAMERA_MIN) {

				if (!this.gallery_mode && this.images.length > 1) {
					this.gallery_mode = true;

					for (var i = 0; i < this.images.length; i++) {
						this.images[i].visible = true;
					}

					this.from_gallery = false;
					this.to_gallery = true;
				}

				this.camera.fov = _CAMERA_MIN;
			} else {
				if (this.gallery_mode && this.images.length > 1) {
					this.gallery_mode = false;

					var _dist = [];

					for (var i = 0; i < this.images.length; i++) {
						_dist[i] = {
							dist: Math.abs(this.camera.position.x - this.images[i].position.x),
							index: i
						};
					}

					_dist.sort(function(a, b) {
						return a.dist - b.dist;
					});

					this.focal_image = this.images[_dist[0].index];

					this.to_gallery = false;
					this.from_gallery = true;
				}
			}

			this.camera.updateProjectionMatrix();
		}

		// add a mesh to the scene
		this.addToScene = function(mesh) {
			_scene.add(mesh);
		}
	} else {
		
		this.camera = {
			position: new THREE.Vector3(),
			fov: 75
		}
	}
}

/*
 * Perform an animation to gallery mode
 */
GALLERY.Gallery.prototype.animateToGallery = function() {

	// move images back into place
	for (var i = 0; i < this.images.length; i++) {
		var _id = this.images[i].imageId - this.focal_image.imageId;

		if (_id < 0) {
			this.images[i].position.x += this.GALLERY_OFFSET;
		} else if (_id > 0) {
			this.images[i].position.x -= this.GALLERY_OFFSET;
		}
	}

	// fix camera if it is off center
	if (this.camera.position.y !== 0) {

	}

	// decrement animation frame counter
	this.animate_frames--;

	// animation done
	if (this.animate_frames <= 0) {
		this.animate_frames = 0;
		this.to_gallery = false;
	}
}

/*
 * Perform animation away from gallery mode
 */
GALLERY.Gallery.prototype.animateFromGallery = function() {

	// move the images away from the focal image
	for (var i = 0; i < this.images.length; i++) {
		var _id = this.images[i].imageId - this.focal_image.imageId;

		if (_id < 0) {
			this.images[i].position.x -= this.GALLERY_OFFSET;
		} else if (_id > 0) {
			this.images[i].position.x += this.GALLERY_OFFSET;
		}
	}

	// increment the frame counter
	this.animate_frames++;

	// once done, make all but the focal image invisible and cancel animation
	if (this.animate_frames >= 60) {
		for (var i = 0; i < this.images.length; i++) {
			if (i !== this.focal_image.imageId) {
				this.images[i].visible = false;
			}
		}
		this.animate_frames = 60;
		this.from_gallery = false;
	}
}

/*
 * Add an image to the loading queue and get its image properties
 */
GALLERY.Gallery.prototype.add = function(image) {

	// set up image instance and preserve this namespace
	var _img = new Image(),
		_that = this;
	_img.src = image.image; // get the image source
	_img.loadingImage = true; // track that the image is loading
	
	this.queue.push(_img); // add it to the queue

	// action to perform when the image has loaded
	_img.onload = function() {

		_img.loadingImage = false; // set loading state to false

		// this ensures FIFO process to preserve the order of the images. Loads an image if it is the first, and then pops it off
		while (_that.queue.length > 0 && !_that.queue[0].loadingImage) {
			_that.load(_that.queue.shift());
		}
	}
}

/*
 * Actually load an image into the gallery
 */
GALLERY.Gallery.prototype.load = function(image) {

	// if three.js is being used
	if (this.using_three) {

		// boilerplate setup of texture, geometry, material, and mesh
		var _texture = new THREE.ImageUtils.loadTexture(image.src),
			_geometry = new THREE.PlaneGeometry(image.width, image.height),
			_material = new THREE.MeshBasicMaterial({
				map: _texture,
				overdraw: true
			}),
			_mesh = new THREE.Mesh(_geometry, _material);
		_mesh.imageWidth = image.width; // store image properties
		_mesh.imageHeight = image.height;
		_mesh.imageId = this.images.length;

		// if there is now more than one image
		if (this.images.length >= 1) {
			this.gallery_mode = true; // gallery mode is on
			_mesh.position.x = (this.images[this.images.length - 1].position.x + (this.images[this.images.length - 1].geometry.vertices[1].x + _mesh.geometry.vertices[1].x)) + this.GALLERY_DIST; // offset to create space between images
			this.gallery_width = _mesh.position.x; // increase width of the gallery
		}

		this.addToScene(_mesh); // add the mesh to the scene
	}
	this.images.push(_mesh); // push that mesh onto an array holding all the images
}

/*
 * Update the state of the gallery
 */
GALLERY.Gallery.prototype.update = function() {

	this.controls.update();
	this.setCamera();

	// check if animating from gallery mode
	if (this.from_gallery) {
		this.animateFromGallery();
	}

	// check if animating to gallery mode
	if (this.to_gallery) {
		this.animateToGallery();
	}

	// render the thing
	this.render();
}
