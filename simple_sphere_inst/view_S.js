var gl;
var program;
var sphere;
var model2clip;
var instanceCount = 13;





var instanceTexture;
var instanceData;

var clickLoc;

var scrolling_number = 0.0;


window.onload = function init() {
    const rows = 7; // Number of rows
    const cols = 10; // Number of columns
    instanceCount = rows * cols;

    const canvas = document.getElementById("gl-canvas");

    // Setup WebGL
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) alert("WebGL isn't available");

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    // Initialize shaders
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);


    //
    //   --------------------- instancing ----------------------
    //

    var colUniformLoc = gl.getUniformLocation(program, "u_col");
    var rowUniformLoc = gl.getUniformLocation(program, "u_row");
    gl.uniform1f(colUniformLoc, -1.0); // Default: invalid position
    gl.uniform1f(rowUniformLoc, -1.0); // Default: invalid position

    clickLoc = gl.getUniformLocation(program, "clickToggle");
    gl.uniform1f(colUniformLoc, -1.0); // Default: invalid position

    // Create instance data
    instanceData = new Float32Array(instanceCount * 4);
    

    let index = 0; // Track the position in the instanceData array
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * 3.0 - (cols - 1); // Spread along x-axis
            const y = row * 2.0 - (rows - 1); // Spread along y-axis
            var z = 0.0;
            if(row==3&&col==1){
                z=0.1;
            }
            // const z = 0.0; // Keep z constant for flat grid
            const w = 1.0; // Unused
            instanceData.set([x, y, z, w], index * 4);
            index++;
        }
    }

    // Create and upload texture
    instanceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, instanceTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, instanceCount, 1, 0, gl.RGBA, gl.FLOAT, instanceData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Create a sphere
    sphere = new Sphere(gl, 19, 8);

    // Setup projection matrix
    aspect = canvas.width / canvas.height;
    Mat.perspective = function (fovY, aspect, near, far) {
        const f = 1.0 / Math.tan((fovY * Math.PI) / 360.0);
        const rangeInv = 1.0 / (near - far);
    
        const perspectiveMatrix = new Mat();
        perspectiveMatrix[0][0] = f / aspect;
        perspectiveMatrix[1][1] = f;
        perspectiveMatrix[2][2] = (near + far) * rangeInv;
        perspectiveMatrix[2][3] = 2 * near * far * rangeInv;
        perspectiveMatrix[3][2] = -1;
        perspectiveMatrix[3][3] = 0;
    
        return perspectiveMatrix;
    };
    const projection = Mat.perspective(45, aspect, 0.1, 100);
    const model2view = Mat.translation(new PV(0, 0, -15));
    model2clip = projection.times(model2view);








    // cube = new Cube(gl);
    sphere = new Sphere(gl, 19, 8);
    // sphere = new Sphere(gl, 3, 4);
    // sphere = new Sphere(gl, 16, 2);
    // sphere = new Sphere(gl, 64, 16);


    // Make the center of the model the origin of the object.
    // var modelT = new PV(-0.5, -0.5, -0.5, false);
    var modelT = new PV(0.0, 0.0, -7);
    var model2object = Mat.translation(modelT);
    var object2model = Mat.translation(modelT.minus());

    // Give the object a small initial rotation in x and y.
    var object2rotated = Mat.rotation(1, 0.1).times(Mat.rotation(0, 0.1));
    var rotated2object = Mat.rotation(0, -0.1).times(Mat.rotation(1, -0.1));

    // Current translation of the object in the world.
    var translation = new PV(0, 0, 0, false);

    // Change z translation to -3.
    translation = new PV(0, 0, -3, false);
    var rotated2world = Mat.translation(translation);
    var world2rotated = Mat.translation(translation.minus());

    var world2view = new Mat();
    var view2world = new Mat();

    // Clicking lookAt button sets world2view and view2world using
    // lookAt() function.
    document.getElementById("lookAt").onclick = function () {
        lookAt();
    };

    // Camera rotates to look at center of object, keeping its x-axis level.
    function lookAt () {

        // eye position is (0,0,0) in view coordinates....
        // object center position is (0,0,0) in object coordinates....
        // Calculate view2world and world2view.
        eye = view2world.times(new PV(true));
        obj = rotated2world.times(new PV(true));
        var wy = new PV(0, 1, 0, false);
        var vz = eye.minus(obj).unit();
        console.log("vz " + vz);
        var vx = wy.cross(vz).unit();
        var vy = vz.cross(vx);

        var R = new Mat(vx, vy, vz);
        var Rinv = R.transpose();

        console.log("R * Rinv\n" + R.times(Rinv));
        var T = Mat.translation(eye);
        var Tinv = Mat.translation(eye.minus());

        view2world = T.times(R);
        world2view = Rinv.times(Tinv);

        console.log("view2world * world2view\n" +
                    view2world.times(world2view));
        updateM2C();
    }
        
    // Simple orthographic projection.
    var view2proj = Mat.scale(new PV(1, 1, -1, false));
    var proj2view = view2proj;
 
    // Display portion of view between z=-near and z=-far.
    var near = 2.0, far = 10.0;

    function setOrthographic () {

        // Set view2proj and proj2view based on values of near and far
        // and the orthographic projection.
        // What value of z translates to 0?
        // How is z scaled so near to far goes to -1 to 1?
        view2proj = Mat.scale(new PV(1, 1, 2/(near - far), true))
            .times(Mat.translation(new PV(0, 0, (near + far)/2, false)));
        proj2view = Mat.translation(new PV(0, 0, -(near + far)/2, false))
            .times(Mat.scale(new PV(1, 1, (near - far)/2, true)));

        console.log("view2proj * proj2view\n" +
                    view2proj.times(proj2view));
        updateM2C();
    }

    function setPerspective () {

        // Set view2proj and proj2view based on values of near and far
        // and the perspective projection.
        // Clicking My Button will switch between ortho and perspective.
        var a = -(far + near) / (far - near);
        var b = -2 * far * near / (far - near);
        view2proj = new Mat();
        view2proj[2][2] = a;
        view2proj[2][3] = b;
        view2proj[3][2] = -1;
        view2proj[3][3] = 0;
        
        proj2view = new Mat();
        proj2view[2][2] = 0;
        proj2view[2][3] = -1;
        proj2view[3][2] = 1 / b;
        proj2view[3][3] = a / b;

        console.log("view2proj * proj2view\n" +
                    view2proj.times(proj2view));
        updateM2C();
    }

    aspect = canvas.width / canvas.height;
    var proj2clip = Mat.scale(new PV(1 / aspect, 1, 1, true));
    var clip2proj = Mat.scale(new PV(aspect, 1, 1, true));

    var clip2canvas =
        Mat.scale(new PV(canvas.width / 2.0, -canvas.height / 2.0, 1, true))
        .times(Mat.translation(new PV(1, -1, 0, false)));
    var canvas2clip =
        Mat.translation(new PV(-1, 1, 0, false))
        .times(Mat.scale(new PV(2.0 / canvas.width, -2.0 / canvas.height, 1, true)));


    setOrthographic();

    updateM2C();

    function updateM2C () {
        model2clip = proj2clip.times(view2proj).times(world2view).times(rotated2world).times(object2rotated).times(model2object);

        console.log("rotated2object\n" + rotated2object);
        console.log("object2model\n" + object2model);
        console.log("world2rotated\n" + world2rotated);

        // White light.
        lightI = new PV(1, 1, 1, true);

        // EXERCISE 2
        // The light position is (10, 0, 10) in the world.
        // lightP should be in MODEL frame.
        lightP = new PV(10, 0, 10, true); // FIX THIS
        lightP = object2model 
            .times(rotated2object)
            .times(world2rotated)
            .times(lightP);

        // eyeP is the eye position in the model frame.
        eyeP = new PV(true); // FIX THIS     this true is 0 0 0
        eyeP = object2model
            .times(rotated2object)
            .times(world2rotated)
            .times(view2world)
            .times(eyeP);
        //MYABE UNITIZE???


        console.log("model2clip " + model2clip);



        
    }

    document.getElementById("slider").oninput = function(event) {
        console.log("slider " + event.target.value);

        zoom = event.target.value / 100;
        console.log("zoom " + zoom);

        proj2clip = Mat.scale(new PV(zoom / aspect, zoom, 1, true));
        clip2proj = Mat.scale(new PV(aspect / zoom, 1 / zoom, 1, true));

        console.log("clip2proj * proj2clip\n" +
                    clip2proj.times(proj2clip));
        updateM2C();
    };

    setPerspective();// annoying to trouble shoot and have to always press the button so i places this here instead for now
    var perspective = false;
    document.getElementById("MyButton").onclick = function () {
        console.log("You clicked My Button!");
        perspective = !perspective;
        if (perspective)
            setPerspective();
        else
            setOrthographic();
    };

    document.getElementById("flat").onclick = function () {
        flatOrRound = flatOrRound != 1 ? 1 : 2;
        console.log("flatOrRound = " + flatOrRound);
    };

    document.getElementById("ZPlus").onclick = function () {
        console.log("You clicked z + 0.1.");

        var T = Mat.translation(new PV(0, 0, 0.1, false));
        var Tinv = Mat.translation(new PV(0, 0, -0.1, false));
        rotated2world = T.times(rotated2world);
        world2rotated = world2rotated.times(Tinv);

        console.log("world2view * view2world\n" +
                    world2view.times(view2world));
        updateM2C();
    };

    document.getElementById("ZMinus").onclick = function () {
        console.log("You clicked z - 0.1.");

        var T = Mat.translation(new PV(0, 0, -0.1, false));
        var Tinv = Mat.translation(new PV(0, 0, 0.1, false));
        rotated2world = T.times(rotated2world);
        world2rotated = world2rotated.times(Tinv);

        console.log("world2view * view2world\n" +
                    world2view.times(view2world));
        updateM2C();
    };

    document.getElementById("VZMinus").onclick = function () {
        console.log("You clicked z - 0.1.");
        var T = Mat.translation(new PV(0, 0, -0.1, false));
        var Tinv = Mat.translation(new PV(0, 0, 0.1, false));
        world2view = Tinv.times(world2view);
        view2world = view2world.times(T);

        console.log("world2view * view2world\n" +
                    world2view.times(view2world));
        updateM2C();
    };

    document.getElementById("VZPlus").onclick = function () {
        console.log("You clicked z + 0.1.");
        var T = Mat.translation(new PV(0, 0, 0.1, false));
        var Tinv = Mat.translation(new PV(0, 0, -0.1, false));
        world2view = Tinv.times(world2view);
        view2world = view2world.times(T);

        console.log("world2view * view2world\n" +
                    world2view.times(view2world));
        updateM2C();
    };

    var clientX, clientY;
    var downWorld;
    var mouseIsDown = false;
    var vertexClickDistance = 10;
    var clickedModel;

    var clicked = 1.0;
    canvas.addEventListener("mousedown", function (e) {

        clickLoc = gl.getUniformLocation(program, "clickToggle");
        gl.uniform1f(clickLoc, clicked);


        clientX = e.clientX;
        clientY = e.clientY;
        var cursorX = e.clientX - canvas.offsetLeft;
        var cursorY = e.clientY - canvas.offsetTop;
        console.log("X: " + cursorX + " Y: " + cursorY);
        var clipX = cursorX * 2 / canvas.width - 1;
        var clipY = -(cursorY * 2 / canvas.height - 1);
        console.log("X: " + clipX + " Y: " + clipY);


        // Calculate mouseCanvas.  Set clickedModel undefined.
        var mouseCanvas = new PV(cursorX, cursorY, 0, true);
        clickedModel = undefined;

        // For each vertex in the model, check if its image in the
        // canvas is less thant vertexClickDistance.
        // If so, set clickedModel.
        for (var i = 0; i < sphere.verts.length; i++) {
            var vertModel = sphere.verts[i];
            var vertCanvas = clip2canvas.times(proj2clip.times(view2proj.times(world2view.times(rotated2world.times(object2rotated.times(model2object.times(vertModel))))))).homogeneous();
            vertCanvas[2] = 0;
            if (mouseCanvas.distance(vertCanvas) < vertexClickDistance)
                clickedModel = vertModel;
        }

        console.log("Mouse canvas: " + mouseCanvas);

        // If clickedModel is defined, print it to the console.
        if (clickedModel != undefined)
            console.log("You clicked on " + clickedModel);


        // Transform center of object to canvas coordinates and
        // homogenenize (use .homogeneous()).
        var objCanvas = clip2canvas.times(proj2clip.times(view2proj.times(world2view.times(rotated2world.times(new PV(true)))))).homogeneous();

        // CHANGE the following mouse click to use the z-coordinate of
        // center of object instead of zero.
        mouseCanvas = new PV(cursorX, cursorY, objCanvas[2], true);

        // Homogenize the following:
        var mouseWorld = view2world.times(proj2view.times(clip2proj.times(canvas2clip.times(mouseCanvas)))).homogeneous();

        downWorld = mouseWorld;
        mouseIsDown = true;
    });

    canvas.addEventListener("mouseup", function (e) {
        mouseIsDown = false;
        if (e.clientX == clientX && e.clientY == clientY) {
            var cursorX = e.clientX - canvas.offsetLeft;
            var cursorY = e.clientY - canvas.offsetTop;
            console.log("X: " + cursorX + " Y: " + cursorY);
            var clipX = cursorX * 2 / canvas.width - 1;
            var clipY = -(cursorY * 2 / canvas.height - 1);
            console.log("X: " + clipX + " Y: " + clipY);
        }
    });
    
    canvas.addEventListener("mousemove", function (e) {
    // if (!mouseIsDown) return;
    if (!mouseIsDown) {
        clicked = 1.0;
    } else {
        clicked = -1.0;
    }
    

    // Convert canvas coordinates to clip space coordinates
    var cursorX = e.clientX - canvas.offsetLeft;
    var cursorY = e.clientY - canvas.offsetTop;
    var clipX = cursorX * 2 / canvas.width - 1; // Range: -1 to 1
    var clipY = -(cursorY * 2 / canvas.height - 1); // Range: -1 to 1

    // Map clipX (-1 to 1) to Coli (0 to cols - 1)
    var Coli = Math.floor((clipX + 1) * (cols / 2));
    // Map clipY (-1 to 1) to Rowi (0 to rows - 1)
    var Rowi = Math.floor((clipY + 1) * (rows / 2));

    // Constrain Rowi and Coli to valid ranges
    // Rowi = Math.max(0, Math.min(rows - 1, Rowi));

    // go from y    -5.5 to 5.5
    console.log(" de y value "+ clipY);
    Rowi = clipY * 5.5;
    // Coli = Math.max(0, Math.min(cols - 1, Coli));
    console.log(" de x value "+ clipX); // clipX goes from -1 to 1, and i want Coli to go from -9.0 to 18.0, how do i use LERP for thsi? if that is the roght thign to do
    // x from -9.0 to 18.0
    // Coli = clipX * (appley lerp or something);
    Coli = -9.0 + (clipX - (-1)) * ((18.0 - (-9.0)) / (1 - (-1)));

    // Log the mapped Rowi and Coli
    console.log(`Mapped Rowi: ${Rowi}, Coli: ${Coli}`);

    colUniformLoc = gl.getUniformLocation(program, "u_col");
    rowUniformLoc = gl.getUniformLocation(program, "u_row");
    gl.uniform1f(colUniformLoc, Coli);
    gl.uniform1f(rowUniformLoc, Rowi);


    //---------attempting to pass in all the data at once--------------
    //
    // // Update instanceData to reset all z-values
    // for (let i = 0; i < instanceCount; i++) {
    //     instanceData[i * 4 + 2] = 0; // Reset z to 0
    // }

    // // Calculate the target index based on Rowi and Coli
    // let targetIndex = Rowi * cols + Coli;

    // // Set z = 4.0 for the selected instance
    // instanceData[targetIndex * 4 + 2] = 5.0;

    // // Re-upload updated instanceData to the GPU
    // gl.bindTexture(gl.TEXTURE_2D, instanceTexture);
    // gl.texImage2D(
    //     gl.TEXTURE_2D,
    //     0,
    //     gl.RGBA32F,
    //     cols,
    //     rows,
    //     0,
    //     gl.RGBA,
    //     gl.FLOAT,
    //     instanceData
    // );
    
    // // if (!mouseIsDown)
    // //     return;

    // // var cursorX = e.clientX - canvas.offsetLeft;
    // // var cursorY = e.clientY - canvas.offsetTop;
    // // console.log("X: " + cursorX + " Y: " + cursorY);
    // // var clipX = cursorX * 2 / canvas.width - 1;
    // // var clipY = -(cursorY * 2 / canvas.height - 1);
    // // console.log("X: " + clipX + " Y: " + clipY);
    // // var Coli = (clipX + 1) * (5 / 2);

    // // // Map clipY (-1 to 1) to Rowi (0 to 3)
    // // var Rowi = (clipY + 1) * (3 / 2);

    // // // Log the mapped values
    // // console.log("Mapped Rowi Coli:"+ Rowi + "  " + Coli);
    
    
        




    // ----------------  other fucntionallitty --------------


        // if (clickedModel == undefined) {

        //     // Same as in mousedown.
        //     var objCanvas = clip2canvas.times(proj2clip.times(view2proj.times(world2view.times(rotated2world.times(new PV(true)))))).homogeneous();
            
        //     var mouseCanvas = new PV(cursorX, cursorY, objCanvas[2], true);
        //     var mouseWorld = view2world.times(proj2view.times(clip2proj.times(canvas2clip.times(mouseCanvas)))).homogeneous();
            
        //     translation = translation.plus(mouseWorld.minus(downWorld));
        //     downWorld = mouseWorld;
            
        //     rotated2world = Mat.translation(translation);
        //     world2rotated = Mat.translation(translation.minus());
            
        //     console.log("rotated2world * world2rotated\n" +
        //                 rotated2world.times(world2rotated));
        // }
        // else {

        //     // Get the frontmost and backmost point corresponding to
        //     // the click point in the canvas.
        //     var fCanvas = new PV(cursorX, cursorY, -1, true);
        //     var bCanvas = new PV(cursorX, cursorY, 1, true);

        //     // Transform them to f and b in the *rotated* frame.
        //     var f = world2rotated.times(view2world.times(proj2view.times(clip2proj.times(canvas2clip.times(fCanvas))))).homogeneous();
        //     var b = world2rotated.times(view2world.times(proj2view.times(clip2proj.times(canvas2clip.times(bCanvas))))).homogeneous();

        //     // u is the unit vector parallel to line fb
        //     var u = b.minus(f).unit();

        //     // o is the center of the object
        //     var o = new PV(true);

        //     // p is the vertex that was clicked on
        //     var p = object2rotated.times(model2object.times(clickedModel));

        //     // v is the vector from o to p
        //     var v = p.minus(o);

        //     // Calculate w, the vector that takes o to the closest
        //     // point on line fb and print it to the console.

        //     // w = of + u s
        //     // u dot w = 0
        //     // u dot (of + u s) = 0
        //     // u dot of + s = 0
        //     // s = - u dot of
        //     // w = of - u (u dot of)
        //     var of = f.minus(o);
        //     var w = of.minus(u.times(u.dot(of)));
        //     console.log("w " + w);


        //     // Update w if it is longer than v.

        //     // If it is shorter, calculate t: the distance along fb to
        //     // a point whose distance from o is the length of v.
        //     // Set w to w + u t or w - ut, whichever is closer to v.

        //     // Print w to the console.

        //     if (w.magnitude() >= v.magnitude())
        //         w = w.unit().times(v.magnitude());
        //     else {
        //         // (w + u t)^2 = v^2
        //         // w^2 + t^2 = v^2
        //         // t^2 = v^2 - w^2
        //         // t = sqrt(v^2 - w^2)
        //         var t2 = v.dot(v) - w.dot(w);
        //         if (t2 < 0)
        //             alert("t2 is " + t2);
        //         var t = Math.sqrt(t2);
        //         console.log("t " + t + "\nt2 " + t2);
        //         var wp = w.plus(u.times(t));
        //         var wm = w.minus(u.times(t));
        //         if (wp.distance(v) < wm.distance(v))
        //             w = wp;
        //         else
        //             w = wm;
        //         console.log("v " + v + "\nw " + w);
        //     }


        //     // No matter how we got w, check if its distance to v is
        //     // less than 1e-6.  If so, just return.
        //     if (w.distance(v) < 1e-6)
        //         return;

        //     // Calculate a rotation that takes v to w.
        //     var vx = v.unit();
        //     var vz = v.cross(w).unit();
        //     var vy = vz.cross(vx);
        //     var wx = w.unit();
        //     var wz = vz;
        //     var wy = wz.cross(wx);
        //     var vMat = new Mat(vx, vy, vz);
        //     var wMat = new Mat(wx, wy, wz);
        //     var vwMat = wMat.times(vMat.transpose());

        //     // How does object2rotated update?
        //     object2rotated = vwMat.times(object2rotated);
        //     rotated2object = rotated2object.times(vwMat.transpose());

        //     // object2rotated = object2rotated;
        //     // rotated2object = rotated2object;
        // }

        updateM2C();
    });

    window.onkeydown = function( event ) {
        switch (event.keyCode) {
        case 37:
            console.log('left');
            break;
        case 38:
            console.log('up');
            break;
        case 39:
            console.log('right');
            break;
        case 40:
            console.log('down');
            break;
        }
        

        // Update world2view and view2world so that arrow keys move
        // the camera in the direction of the arrow by 0.1 units.
        if (37 <= event.keyCode && event.keyCode <= 40) {
            var t = [ [ -0.1, 0 ], [ 0, 0.1 ], [ 0.1, 0 ], [ 0, -0.1 ] ];
            var i = event.keyCode - 37;
            var t = new PV(t[i][0], t[i][1], 0, false);
            world2view = Mat.translation(t.minus()).times(world2view);
            view2world = view2world.times(Mat.translation(t));
            updateM2C();
            return;
        }
        
        var key = String.fromCharCode(event.keyCode);
        var rotSign = event.shiftKey ? -1 : 1;
        console.log("You clicked " + key);
        switch( key ) {
        case 'X':
            object2rotated = Mat.rotation(0, 0.1 * rotSign).times(object2rotated);
            rotated2object = rotated2object.times(Mat.rotation(0, -0.1 * rotSign));
            break;
            
        case 'Y':
            object2rotated = Mat.rotation(1, 0.1 * rotSign).times(object2rotated);
            rotated2object = rotated2object.times(Mat.rotation(1, -0.1 * rotSign));
            break;
            
        case 'Z':
            object2rotated = Mat.rotation(2, 0.1 * rotSign).times(object2rotated);
            rotated2object = rotated2object.times(Mat.rotation(2, -0.1 * rotSign));
            break;
        
        case '1':
            // key 1 press down
            // console.log("instanco datao" + instanceData);
            // scrolling_number+=0.09;
            console.log("num scroll" + scrollign_number);
            
            



        // Re Upload Data to the Texture EXERCISE 1 !!!
            gl.bindTexture(gl.TEXTURE_2D, instanceTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, instanceCount, 1, 0, gl.RGBA, gl.FLOAT, instanceData);

            console.log("the new kid in town   1");



            break;
        }

        
        updateM2C();

    };

    window.onresize = function (event) {
        console.log("resize " + canvas.width + " " + canvas.height);
    }







    render();
};

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


  

    scrolling_number += 0.05;
    // Pass scrolling_number to the shader
    const scrollLoc = gl.getUniformLocation(program, "scrolling_number");
    gl.uniform1f(scrollLoc, scrolling_number);




    // Bind instance texture
    const textureLoc = gl.getUniformLocation(program, "instanceTexture");
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, instanceTexture);
    gl.uniform1i(textureLoc, 0);

    // Set projection matrix
    const model2clipLoc = gl.getUniformLocation(program, "model2clip");
    gl.uniformMatrix4fv(model2clipLoc, false, model2clip.flatten());



    // gl.uniform4fv(gl.getUniformLocation(program, "lightP"), lightP.flatten());
    // gl.uniform4fv(gl.getUniformLocation(program, "lightI"), lightI.flatten());
    // gl.uniform4fv(gl.getUniformLocation(program, "eyeP"), eyeP.flatten());    



    // Render the sphere
    sphere.render(gl, program, 1, instanceCount);

    requestAnimFrame(render);
}
