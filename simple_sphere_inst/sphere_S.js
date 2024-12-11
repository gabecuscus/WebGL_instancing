class Sphere {
    constructor(gl, nLon, nLat) {
        this.verts = [];
        this.vertex_normals = [];
        this.face_elements = [];
        this.face_normals = [];

        const rotStep = Mat.rotation(0, 2 * Math.PI / nLon);
        const o = new PV(true);

        for (let i = 0; i < nLat; i++) {
            const lat = Math.PI / (2 * nLat) * (1 + 2 * i);
            let p = new PV(Math.cos(lat), Math.sin(lat), 0, true);
            for (let j = 0; j < nLon; j++) {
                const n = p.minus(o).unit();
                this.verts.push(p);
                this.vertex_normals.push(n);
                p = rotStep.times(p);
            }
        }

        // Generate faces
        for (let i = 1; i < nLat; i++) {
            for (let j = 0; j < nLon; j++) {
                const vInds = [
                    nLon * i + j,
                    nLon * i + (j + 1) % nLon,
                    nLon * (i - 1) + (j + 1) % nLon,
                    nLon * (i - 1) + j,
                ];
                this.face_elements.push(vInds);
            }
        }

        // Calculate face normals
        for (const face of this.face_elements) {
            let n = new PV(false);
            for (let j = 2; j < face.length; j++) {
                const p0 = this.verts[face[0]];
                const p1 = this.verts[face[j - 1]];
                const p2 = this.verts[face[j]];
                n = n.plus(p1.minus(p0).cross(p2.minus(p0)));
            }
            n.unitize();
            this.face_normals.push(n);
        }

        // Upload vertex data to GPU
        this.vertex_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.verts), gl.STATIC_DRAW);

        this.normal_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normal_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertex_normals), gl.STATIC_DRAW);

        this.element_buffers = this.face_elements.map((face) => {
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, flattenElements(face), gl.STATIC_DRAW);
            return buffer;
        });
    }

    render(gl, program, flatOrRound, numInstances) {
        const vPosition = gl.getAttribLocation(program, "vPosition");
        const colorLoc = gl.getUniformLocation(program, "color");
        const useNormalLoc = gl.getUniformLocation(program, "useNormal");

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);

        for (let i = 0; i < this.face_elements.length; i++) {
            const color = new PV(1, 0, 1, 1); // Purple
            gl.uniform4fv(colorLoc, color.flatten());
            gl.uniform1i(useNormalLoc, flatOrRound);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.element_buffers[i]);
            gl.drawElementsInstanced(gl.TRIANGLE_FAN, this.face_elements[i].length, gl.UNSIGNED_SHORT, 0, numInstances);
        }
    }
}
