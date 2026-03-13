/* ═══════════════════════════════════════════════════════════════════════
   gallery-infinite.js — WebGL Infinite Sphere Menu (vanilla JS port)
   Original concept: InfiniteMenu by reactbits.dev
   Adapted for NMC Gallery — no React, no npm, uses gl-matrix CDN UMD build
═══════════════════════════════════════════════════════════════════════ */

/* gl-matrix is loaded as a UMD bundle from CDN → exposes window.glMatrix */
const { mat4, quat, vec2, vec3 } = glMatrix;

/* ── GLSL Shaders ─────────────────────────────────────────────────────── */
const DISC_VERT = `#version 300 es
uniform mat4 uWorldMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uCameraPosition;
uniform vec4 uRotationAxisVelocity;

in vec3 aModelPosition;
in vec3 aModelNormal;
in vec2 aModelUvs;
in mat4 aInstanceMatrix;
in float aInstanceAspect;  /* per-instance: image width/height */

out vec2 vUvs;
out float vAlpha;
flat out int vInstanceId;

#define PI 3.141593

void main() {
    /* scale the card Y to match this image's aspect ratio */
    vec3 scaledPos = aModelPosition;
    scaledPos.y /= max(0.1, aInstanceAspect);

    vec4 worldPosition = uWorldMatrix * aInstanceMatrix * vec4(scaledPos, 1.);
    vec3 centerPos = (uWorldMatrix * aInstanceMatrix * vec4(0., 0., 0., 1.)).xyz;
    float radius = length(centerPos.xyz);

    if (gl_VertexID > 0) {
        vec3 rotationAxis = uRotationAxisVelocity.xyz;
        float rotationVelocity = min(.06, uRotationAxisVelocity.w * 4.);
        vec3 stretchDir = normalize(cross(centerPos, rotationAxis));
        vec3 relativeVertexPos = normalize(worldPosition.xyz - centerPos);
        float strength = dot(stretchDir, relativeVertexPos);
        float invAbsStrength = min(0., abs(strength) - 1.);
        strength = rotationVelocity * sign(strength) * abs(invAbsStrength * invAbsStrength * invAbsStrength + 1.);
        worldPosition.xyz += stretchDir * strength;
    }

    worldPosition.xyz = radius * normalize(worldPosition.xyz);
    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
    vAlpha = smoothstep(0.5, 1., normalize(worldPosition.xyz).z) * .9 + .1;
    vUvs = aModelUvs;
    vInstanceId = gl_InstanceID;
}`;

const DISC_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform int uItemCount;
uniform int uAtlasSize;

out vec4 outColor;
in vec2 vUvs;
in float vAlpha;
flat in int vInstanceId;

void main() {
    int itemIndex = vInstanceId % uItemCount;
    int cellsPerRow = uAtlasSize;
    int cellX = itemIndex % cellsPerRow;
    int cellY = itemIndex / cellsPerRow;
    vec2 cellSize = vec2(1.0) / vec2(float(cellsPerRow));
    vec2 cellOffset = vec2(float(cellX), float(cellY)) * cellSize;

    // straight UV mapping — no aspect-ratio distortion
    vec2 st = vec2(vUvs.x, 1.0 - vUvs.y);
    st = clamp(st, 0.0, 1.0);
    st = st * cellSize + cellOffset;

    outColor = texture(uTex, st);
    outColor.a *= vAlpha;
}`;

/* ── Geometry helpers ─────────────────────────────────────────────────── */
class Face { constructor(a,b,c){ this.a=a; this.b=b; this.c=c; } }

class Vertex {
    constructor(x,y,z){ this.position=vec3.fromValues(x,y,z); this.normal=vec3.create(); this.uv=vec2.create(); }
}

class Geometry {
    constructor(){ this.vertices=[]; this.faces=[]; }

    addVertex(...args){
        for(let i=0;i<args.length;i+=3) this.vertices.push(new Vertex(args[i],args[i+1],args[i+2]));
        return this;
    }
    addFace(...args){
        for(let i=0;i<args.length;i+=3) this.faces.push(new Face(args[i],args[i+1],args[i+2]));
        return this;
    }
    get lastVertex(){ return this.vertices[this.vertices.length-1]; }

    subdivide(divisions=1){
        const cache={};
        let f=this.faces;
        for(let d=0;d<divisions;++d){
            const nf=new Array(f.length*4);
            f.forEach((face,ndx)=>{
                const mAB=this._mid(face.a,face.b,cache);
                const mBC=this._mid(face.b,face.c,cache);
                const mCA=this._mid(face.c,face.a,cache);
                const i=ndx*4;
                nf[i+0]=new Face(face.a,mAB,mCA);
                nf[i+1]=new Face(face.b,mBC,mAB);
                nf[i+2]=new Face(face.c,mCA,mBC);
                nf[i+3]=new Face(mAB,mBC,mCA);
            });
            f=nf;
        }
        this.faces=f; return this;
    }

    spherize(radius=1){
        this.vertices.forEach(v=>{
            vec3.normalize(v.normal,v.position);
            vec3.scale(v.position,v.normal,radius);
        });
        return this;
    }

    _mid(a,b,cache){
        const key=a<b?`${b}_${a}`:`${a}_${b}`;
        if(cache[key]!==undefined) return cache[key];
        const pa=this.vertices[a].position, pb=this.vertices[b].position;
        const ndx=this.vertices.length;
        cache[key]=ndx;
        this.addVertex((pa[0]+pb[0])*.5,(pa[1]+pb[1])*.5,(pa[2]+pb[2])*.5);
        return ndx;
    }

    get vertexData(){ return new Float32Array(this.vertices.flatMap(v=>Array.from(v.position))); }
    get normalData(){ return new Float32Array(this.vertices.flatMap(v=>Array.from(v.normal))); }
    get uvData(){ return new Float32Array(this.vertices.flatMap(v=>Array.from(v.uv))); }
    get indexData(){ return new Uint16Array(this.faces.flatMap(f=>[f.a,f.b,f.c])); }
    get data(){ return {vertices:this.vertexData,indices:this.indexData,normals:this.normalData,uvs:this.uvData}; }
}

class IcosahedronGeometry extends Geometry {
    constructor(){
        super();
        const t=Math.sqrt(5)*.5+.5;
        this.addVertex(-1,t,0, 1,t,0, -1,-t,0, 1,-t,0, 0,-1,t, 0,1,t, 0,-1,-t, 0,1,-t, t,0,-1, t,0,1, -t,0,-1, -t,0,1)
            .addFace(0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11, 1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8, 3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9, 4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1);
    }
}

/* Unit-square base — aspect ratio applied per-instance in vertex shader */
class QuadGeometry extends Geometry {
    constructor() {
        super();
        this.addVertex(-0.5, -0.5, 0); this.lastVertex.uv[0]=0; this.lastVertex.uv[1]=0;
        this.addVertex( 0.5, -0.5, 0); this.lastVertex.uv[0]=1; this.lastVertex.uv[1]=0;
        this.addVertex( 0.5,  0.5, 0); this.lastVertex.uv[0]=1; this.lastVertex.uv[1]=1;
        this.addVertex(-0.5,  0.5, 0); this.lastVertex.uv[0]=0; this.lastVertex.uv[1]=1;
        this.addFace(0,1,2);
        this.addFace(0,2,3);
    }
}

/* ── WebGL helpers ────────────────────────────────────────────────────── */
function createShader(gl,type,src){
    const s=gl.createShader(type);
    gl.shaderSource(s,src); gl.compileShader(s);
    if(gl.getShaderParameter(s,gl.COMPILE_STATUS)) return s;
    console.error(gl.getShaderInfoLog(s)); gl.deleteShader(s); return null;
}

function createProgram(gl,srcs,attribLocs){
    const p=gl.createProgram();
    [gl.VERTEX_SHADER,gl.FRAGMENT_SHADER].forEach((t,i)=>{
        const s=createShader(gl,t,srcs[i]);
        if(s) gl.attachShader(p,s);
    });
    if(attribLocs) for(const a in attribLocs) gl.bindAttribLocation(p,attribLocs[a],a);
    gl.linkProgram(p);
    if(gl.getProgramParameter(p,gl.LINK_STATUS)) return p;
    console.error(gl.getProgramInfoLog(p)); gl.deleteProgram(p); return null;
}

function makeBuffer(gl,data,usage){
    const b=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,b);
    gl.bufferData(gl.ARRAY_BUFFER,data,usage);
    gl.bindBuffer(gl.ARRAY_BUFFER,null);
    return b;
}

function makeVAO(gl,pairs,indices){
    const va=gl.createVertexArray();
    gl.bindVertexArray(va);
    for(const [buf,loc,n] of pairs){
        if(loc===-1) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER,buf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc,n,gl.FLOAT,false,0,0);
    }
    if(indices){
        const ib=gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    }
    gl.bindVertexArray(null);
    return va;
}

function resizeCanvas(canvas){
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const w=Math.round(canvas.clientWidth*dpr), h=Math.round(canvas.clientHeight*dpr);
    if(canvas.width!==w||canvas.height!==h){ canvas.width=w; canvas.height=h; return true; }
    return false;
}

function setupTexture(gl){
    const t=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    return t;
}

/* ── ArcballControl ───────────────────────────────────────────────────── */
class ArcballControl {
    constructor(canvas,cb){
        this.canvas=canvas;
        this.cb=cb||(() =>{});
        this.isPointerDown=false;
        this.orientation=quat.create();
        this.pointerRotation=quat.create();
        this.rotationVelocity=0;
        this.rotationAxis=vec3.fromValues(1,0,0);
        this.snapDirection=vec3.fromValues(0,0,-1);
        this.snapTargetDirection=null;
        this.EPSILON=0.1;
        this.IDENTITY=quat.create();
        this._pointerPos=vec2.create();
        this._prevPos=vec2.create();
        this._rv=0;
        this._cq=quat.create();

        canvas.addEventListener('pointerdown',e=>{ vec2.set(this._pointerPos,e.clientX,e.clientY); vec2.copy(this._prevPos,this._pointerPos); this.isPointerDown=true; });
        canvas.addEventListener('pointerup',()=>{ this.isPointerDown=false; });
        canvas.addEventListener('pointerleave',()=>{ this.isPointerDown=false; });
        canvas.addEventListener('pointermove',e=>{ if(this.isPointerDown) vec2.set(this._pointerPos,e.clientX,e.clientY); });
        canvas.style.touchAction='none';
    }

    update(dt,targetDt=16){
        const ts=dt/targetDt+0.00001;
        let af=ts, snap=quat.create();

        if(this.isPointerDown){
            const INT=0.3*ts, AMP=2.5/ts;
            const mid=vec2.sub(vec2.create(),this._pointerPos,this._prevPos);
            vec2.scale(mid,mid,INT);
            if(vec2.sqrLen(mid)>this.EPSILON){
                vec2.add(mid,this._prevPos,mid);
                const p=this._project(mid), q=this._project(this._prevPos);
                vec2.copy(this._prevPos,mid);
                af*=AMP;
                this.quatFromVecs(vec3.normalize(vec3.create(),p),vec3.normalize(vec3.create(),q),this.pointerRotation,af);
            } else {
                quat.slerp(this.pointerRotation,this.pointerRotation,this.IDENTITY,INT);
            }
        } else {
            quat.slerp(this.pointerRotation,this.pointerRotation,this.IDENTITY,0.1*ts);
            if(this.snapTargetDirection){
                const a=this.snapTargetDirection, b=this.snapDirection;
                const sqd=vec3.squaredDistance(a,b);
                const df=Math.max(0.1,1-sqd*10);
                af*=0.2*df;
                this.quatFromVecs(a,b,snap,af);
            }
        }

        const cq=quat.multiply(quat.create(),snap,this.pointerRotation);
        this.orientation=quat.multiply(quat.create(),cq,this.orientation);
        quat.normalize(this.orientation,this.orientation);

        quat.slerp(this._cq,this._cq,cq,0.8*ts);
        quat.normalize(this._cq,this._cq);

        const rad=Math.acos(this._cq[3])*2;
        const s=Math.sin(rad/2);
        let rv=0;
        if(s>0.000001){
            rv=rad/(2*Math.PI);
            this.rotationAxis[0]=this._cq[0]/s;
            this.rotationAxis[1]=this._cq[1]/s;
            this.rotationAxis[2]=this._cq[2]/s;
        }
        this._rv+=(rv-this._rv)*(0.5*ts);
        this.rotationVelocity=this._rv/ts;
        this.cb(dt);
    }

    quatFromVecs(a,b,out,af=1){
        const axis=vec3.normalize(vec3.create(),vec3.cross(vec3.create(),a,b));
        const d=Math.max(-1,Math.min(1,vec3.dot(a,b)));
        quat.setAxisAngle(out,axis,Math.acos(d)*af);
        return out;
    }

    _project(pos){
        const r=2, w=this.canvas.clientWidth, h=this.canvas.clientHeight, s=Math.max(w,h)-1;
        const x=(2*pos[0]-w-1)/s, y=(2*pos[1]-h-1)/s;
        const xySq=x*x+y*y, rSq=r*r;
        const z=xySq<=rSq/2?Math.sqrt(rSq-xySq):rSq/Math.sqrt(xySq);
        return vec3.fromValues(-x,y,z);
    }
}

/* ── InfiniteGridMenu ─────────────────────────────────────────────────── */
class InfiniteGridMenu {
    TARGET_FPS = 1000/60;
    SPHERE_RADIUS = 2;
    #time=0; #dt=0; #dFrames=0; #frames=0;
    nearestVertexIndex=null;
    smoothRV=0;
    movementActive=false;

    camera={
        matrix:mat4.create(), near:.1, far:40, fov:Math.PI/4, aspect:1,
        position:vec3.fromValues(0,0,3), up:vec3.fromValues(0,1,0),
        matrices:{ view:mat4.create(), projection:mat4.create(), inversProjection:mat4.create() }
    };

    constructor(canvas,items,onActiveItem,onMovement,onInit,scale=1){
        this.canvas=canvas;
        this.items=items||[];
        this.onActiveItem=onActiveItem||(() =>{});
        this.onMovement=onMovement||(() =>{});
        this.scale=scale;
        this.camera.position[2]=3*scale;
        this._init(onInit);
    }

    resize(){
        this.vpSize=vec2.set(this.vpSize||vec2.create(),this.canvas.clientWidth,this.canvas.clientHeight);
        const gl=this.gl;
        if(resizeCanvas(gl.canvas)) gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
        this._updateProjection();
    }

    run(t=0){
        this.#dt=Math.min(32,t-this.#time);
        this.#time=t;
        this.#dFrames=this.#dt/this.TARGET_FPS;
        this.#frames+=this.#dFrames;
        this._animate(this.#dt);
        this._render();
        this._rafId=requestAnimationFrame(t2=>this.run(t2));
    }

    destroy(){
        if(this._rafId) cancelAnimationFrame(this._rafId);
    }

    _init(onInit){
        this.gl=this.canvas.getContext('webgl2',{antialias:true,alpha:true,premultipliedAlpha:false});
        const gl=this.gl;
        if(!gl) throw new Error('WebGL2 not supported');

        this.prog=createProgram(gl,[DISC_VERT,DISC_FRAG],{
            aModelPosition:0, aModelNormal:1, aModelUvs:2, aInstanceMatrix:3, aInstanceAspect:8
        });
        this.locs={
            aModelPosition: gl.getAttribLocation(this.prog,'aModelPosition'),
            aModelUvs:      gl.getAttribLocation(this.prog,'aModelUvs'),
            aInstanceMatrix:gl.getAttribLocation(this.prog,'aInstanceMatrix'),
            aInstanceAspect:gl.getAttribLocation(this.prog,'aInstanceAspect'),
            uWorldMatrix:   gl.getUniformLocation(this.prog,'uWorldMatrix'),
            uViewMatrix:    gl.getUniformLocation(this.prog,'uViewMatrix'),
            uProjectionMatrix:gl.getUniformLocation(this.prog,'uProjectionMatrix'),
            uCameraPosition:gl.getUniformLocation(this.prog,'uCameraPosition'),
            uRotationAxisVelocity:gl.getUniformLocation(this.prog,'uRotationAxisVelocity'),
            uTex:           gl.getUniformLocation(this.prog,'uTex'),
            uFrames:        gl.getUniformLocation(this.prog,'uFrames'),
            uItemCount:     gl.getUniformLocation(this.prog,'uItemCount'),
            uAtlasSize:     gl.getUniformLocation(this.prog,'uAtlasSize'),
        };

        const discGeo=new QuadGeometry();
        const db=discGeo.data;
        this.discBuf=db;
        this.discVAO=makeVAO(gl,[
            [makeBuffer(gl,db.vertices,gl.STATIC_DRAW),this.locs.aModelPosition,3],
            [makeBuffer(gl,db.uvs,gl.STATIC_DRAW),this.locs.aModelUvs,2],
        ],db.indices);

        const ico=new IcosahedronGeometry();
        ico.subdivide(1).spherize(this.SPHERE_RADIUS);
        this.instancePositions=ico.vertices.map(v=>v.position);
        this.instanceCount=ico.vertices.length;
        this._initInstances();

        this.worldMatrix=mat4.create();
        this._initTexture();
        this.control=new ArcballControl(this.canvas,dt=>this._onControl(dt));
        this._updateCamera();
        this._updateProjection();
        this.resize();
        if(onInit) onInit(this);
    }

    _initTexture(){
        const gl=this.gl;
        this.tex=setupTexture(gl);
        const count=Math.max(1,this.items.length);
        this.atlasSize=Math.ceil(Math.sqrt(count));
        const atlas=document.createElement('canvas');
        const ctx=atlas.getContext('2d');
        const cell=512;
        atlas.width=this.atlasSize*cell;
        atlas.height=this.atlasSize*cell;

        /* default grey placeholder so texture is valid before images load */
        ctx.fillStyle='#1a2230';
        ctx.fillRect(0,0,atlas.width,atlas.height);

        Promise.all(this.items.map(item=>new Promise(res=>{
            const img=new Image();
            img.crossOrigin='anonymous';
            img.onload=()=>res(img);
            img.onerror=()=>res(null);
            img.src=item.image;
        }))).then(images=>{
            /* build aspect ratio array (per-item, cycles across all instances) */
            const itemAspects=images.map(img=>img ? img.naturalWidth/img.naturalHeight : 1.0);
            /* fill per-instance aspect buffer */
            const aspects=new Float32Array(this.instanceCount);
            for(let i=0;i<this.instanceCount;i++){
                const idx=i%Math.max(1,itemAspects.length);
                aspects[i]=itemAspects[idx]||1.0;
            }
            gl.bindBuffer(gl.ARRAY_BUFFER,this.aspectBuf);
            gl.bufferSubData(gl.ARRAY_BUFFER,0,aspects);
            gl.bindBuffer(gl.ARRAY_BUFFER,null);

            /* draw each image with letterbox/pillarbox into its atlas cell so pixels aren't squished */
            images.forEach((img,i)=>{
                if(!img) return;
                const cx=(i%this.atlasSize)*cell;
                const cy=Math.floor(i/this.atlasSize)*cell;
                const imgAspect=img.naturalWidth/img.naturalHeight;
                let dx=0, dy=0, dw=cell, dh=cell;
                if(imgAspect>1){ /* landscape — letterbox top/bottom */
                    dh=Math.round(cell/imgAspect);
                    dy=Math.round((cell-dh)/2);
                } else {         /* portrait — pillarbox left/right */
                    dw=Math.round(cell*imgAspect);
                    dx=Math.round((cell-dw)/2);
                }
                ctx.drawImage(img,cx+dx,cy+dy,dw,dh);
            });

            gl.bindTexture(gl.TEXTURE_2D,this.tex);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
            gl.generateMipmap(gl.TEXTURE_2D);
        });
    }

    _initInstances(){
        const gl=this.gl;
        const count=this.instanceCount;
        this.inst={
            arr:new Float32Array(count*16),
            mats:[],
            buf:gl.createBuffer()
        };
        for(let i=0;i<count;++i){
            const m=new Float32Array(this.inst.arr.buffer,i*16*4,16);
            m.set(mat4.create());
            this.inst.mats.push(m);
        }
        gl.bindVertexArray(this.discVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.inst.buf);
        gl.bufferData(gl.ARRAY_BUFFER,this.inst.arr.byteLength,gl.DYNAMIC_DRAW);
        for(let j=0;j<4;++j){
            const loc=this.locs.aInstanceMatrix+j;
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc,4,gl.FLOAT,false,64,j*16);
            gl.vertexAttribDivisor(loc,1);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER,null);

        /* per-instance aspect ratio buffer (default 1.0, updated after images load) */
        const defaultAspects=new Float32Array(count).fill(1.0);
        this.aspectBuf=gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,this.aspectBuf);
        gl.bufferData(gl.ARRAY_BUFFER,defaultAspects,gl.DYNAMIC_DRAW);
        const aLoc=this.locs.aInstanceAspect;
        if(aLoc!==-1){
            gl.enableVertexAttribArray(aLoc);
            gl.vertexAttribPointer(aLoc,1,gl.FLOAT,false,0,0);
            gl.vertexAttribDivisor(aLoc,1);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER,null);
        gl.bindVertexArray(null);
    }

    _animate(dt){
        const gl=this.gl;
        this.control.update(dt,this.TARGET_FPS);
        const scale=0.25, si=0.6;
        this.instancePositions.forEach((p,i)=>{
            const wp=vec3.transformQuat(vec3.create(),p,this.control.orientation);
            const s=(Math.abs(wp[2])/this.SPHERE_RADIUS)*si+(1-si);
            const fs=s*scale;
            const m=mat4.create();
            mat4.multiply(m,m,mat4.fromTranslation(mat4.create(),vec3.negate(vec3.create(),wp)));
            mat4.multiply(m,m,mat4.targetTo(mat4.create(),[0,0,0],wp,[0,1,0]));
            mat4.multiply(m,m,mat4.fromScaling(mat4.create(),[fs,fs,fs]));
            mat4.multiply(m,m,mat4.fromTranslation(mat4.create(),[0,0,-this.SPHERE_RADIUS]));
            mat4.copy(this.inst.mats[i],m);
        });
        gl.bindBuffer(gl.ARRAY_BUFFER,this.inst.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER,0,this.inst.arr);
        gl.bindBuffer(gl.ARRAY_BUFFER,null);
        this.smoothRV=this.control.rotationVelocity;
    }

    _render(){
        const gl=this.gl;
        gl.useProgram(this.prog);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

        gl.uniformMatrix4fv(this.locs.uWorldMatrix,false,this.worldMatrix);
        gl.uniformMatrix4fv(this.locs.uViewMatrix,false,this.camera.matrices.view);
        gl.uniformMatrix4fv(this.locs.uProjectionMatrix,false,this.camera.matrices.projection);
        gl.uniform3f(this.locs.uCameraPosition,...this.camera.position);
        gl.uniform4f(this.locs.uRotationAxisVelocity,...this.control.rotationAxis,this.smoothRV*0.6);
        gl.uniform1i(this.locs.uItemCount,this.items.length||1);
        gl.uniform1i(this.locs.uAtlasSize,this.atlasSize);
        gl.uniform1f(this.locs.uFrames,this.#frames);
        gl.uniform1i(this.locs.uTex,0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,this.tex);
        gl.bindVertexArray(this.discVAO);
        gl.drawElementsInstanced(gl.TRIANGLES,this.discBuf.indices.length,gl.UNSIGNED_SHORT,0,this.instanceCount);
    }

    _updateCamera(){
        mat4.targetTo(this.camera.matrix,this.camera.position,[0,0,0],this.camera.up);
        mat4.invert(this.camera.matrices.view,this.camera.matrix);
    }

    _updateProjection(){
        const gl=this.gl;
        this.camera.aspect=gl.canvas.clientWidth/gl.canvas.clientHeight;
        const h=this.SPHERE_RADIUS*0.35, d=this.camera.position[2];
        this.camera.fov=this.camera.aspect>1?2*Math.atan(h/d):2*Math.atan(h/this.camera.aspect/d);
        mat4.perspective(this.camera.matrices.projection,this.camera.fov,this.camera.aspect,this.camera.near,this.camera.far);
        mat4.invert(this.camera.matrices.inversProjection,this.camera.matrices.projection);
    }

    _onControl(dt){
        const ts=dt/this.TARGET_FPS+0.0001;
        let damp=5/ts;
        let targetZ=3*this.scale;
        const moving=this.control.isPointerDown||Math.abs(this.smoothRV)>0.01;
        if(moving!==this.movementActive){ this.movementActive=moving; this.onMovement(moving); }
        if(!this.control.isPointerDown){
            const ni=this._nearestVertex();
            this.onActiveItem(ni%Math.max(1,this.items.length));
            this.control.snapTargetDirection=vec3.normalize(vec3.create(),this._vertexWorldPos(ni));
        } else {
            targetZ+=this.control.rotationVelocity*80+2.5;
            damp=7/ts;
        }
        this.camera.position[2]+=(targetZ-this.camera.position[2])/damp;
        this._updateCamera();
    }

    _nearestVertex(){
        const n=this.control.snapDirection;
        const inv=quat.conjugate(quat.create(),this.control.orientation);
        const nt=vec3.transformQuat(vec3.create(),n,inv);
        let maxD=-1, idx=0;
        this.instancePositions.forEach((p,i)=>{ const d=vec3.dot(nt,p); if(d>maxD){ maxD=d; idx=i; } });
        return idx;
    }

    _vertexWorldPos(i){
        return vec3.transformQuat(vec3.create(),this.instancePositions[i],this.control.orientation);
    }
}

/* ── Public init function ─────────────────────────────────────────────── */
window.initInfiniteGallery = function(container, items, scale=0.85) {
    // Build canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'infinite-grid-menu-canvas';
    container.appendChild(canvas);

    // Overlay elements
    const titleEl   = document.createElement('h2');
    titleEl.className = 'igm-title inactive';
    container.appendChild(titleEl);

    const descEl   = document.createElement('p');
    descEl.className = 'igm-desc inactive';
    container.appendChild(descEl);

    const btn = document.createElement('div');
    btn.className = 'igm-btn inactive';
    btn.innerHTML = '<span class="igm-btn-icon">&#x2197;</span>';
    container.appendChild(btn);

    let activeItem = null;

    const onActive = idx => {
        if(!items.length) return;
        activeItem = items[idx];
        titleEl.textContent  = activeItem.title       || '';
        descEl.textContent   = activeItem.description || '';
    };

    const onMovement = moving => {
        const cls = moving ? 'inactive' : 'active';
        const old = moving ? 'active' : 'inactive';
        [titleEl, descEl, btn].forEach(el => { el.classList.remove(old); el.classList.add(cls); });
    };

    btn.addEventListener('click', () => {
        if(!activeItem?.link) return;
        if(activeItem.link.startsWith('http')) window.open(activeItem.link, '_blank');
    });

    const menu = new InfiniteGridMenu(canvas, items, onActive, onMovement, sk => {
        sk.run();
        const ro = new ResizeObserver(() => sk.resize());
        ro.observe(container);
    }, scale);

    return menu;
};
