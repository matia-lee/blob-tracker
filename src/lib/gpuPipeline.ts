import type { BinaryMask } from "./binaryMask";

export interface GpuPipeline {
  process(video: HTMLVideoElement, threshold: number): BinaryMask;
  dispose(): void;
}

const VERT = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const DIFF_FRAG = `#version 300 es
precision mediump float;
uniform sampler2D uCurrent;
uniform sampler2D uPrevious;
uniform float uThreshold;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec3 curr = texture(uCurrent, vUv).rgb;
  vec3 prev = texture(uPrevious, vUv).rgb;
  vec3 d = abs(curr - prev);
  fragColor = vec4(step(uThreshold, max(d.r, max(d.g, d.b))), 0.0, 0.0, 1.0);
}`;

const MORPH_FRAG = `#version 300 es
precision mediump float;
uniform sampler2D uMask;
uniform vec2 uTexelSize;
uniform bool uErode;
in vec2 vUv;
out vec4 fragColor;
void main() {
  float c = texture(uMask, vUv).r;
  float l = texture(uMask, vUv + vec2(-uTexelSize.x, 0.0)).r;
  float r = texture(uMask, vUv + vec2(uTexelSize.x, 0.0)).r;
  float t = texture(uMask, vUv + vec2(0.0, -uTexelSize.y)).r;
  float b = texture(uMask, vUv + vec2(0.0, uTexelSize.y)).r;
  float result = uErode ? c * l * r * t * b : max(c, max(l, max(r, max(t, b))));
  fragColor = vec4(result, 0.0, 0.0, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function link(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const p = gl.createProgram();
  if (!p) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

function createTex(gl: WebGL2RenderingContext, filter: number): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function createFbo(gl: WebGL2RenderingContext, w: number, h: number) {
  const tex = createTex(gl, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

/** Create a GPU-accelerated pipeline for motion mask computation. Returns null if WebGL2 is unavailable. */
export function createGpuPipeline(width: number, height: number): GpuPipeline | null {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) return null;

  const diffProg = link(gl, VERT, DIFF_FRAG);
  const morphProg = link(gl, VERT, MORPH_FRAG);
  if (!diffProg || !morphProg) {
    if (diffProg) gl.deleteProgram(diffProg);
    if (morphProg) gl.deleteProgram(morphProg);
    return null;
  }

  const diff = {
    uCurrent: gl.getUniformLocation(diffProg, "uCurrent"),
    uPrevious: gl.getUniformLocation(diffProg, "uPrevious"),
    uThreshold: gl.getUniformLocation(diffProg, "uThreshold"),
  };
  const morph = {
    uMask: gl.getUniformLocation(morphProg, "uMask"),
    uTexelSize: gl.getUniformLocation(morphProg, "uTexelSize"),
    uErode: gl.getUniformLocation(morphProg, "uErode"),
  };

  // Fullscreen quad VAO
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Video textures (ping-pong current/previous)
  const vidTex = [createTex(gl, gl.LINEAR), createTex(gl, gl.LINEAR)];
  let vidIdx = 0;
  let firstFrame = true;

  // Processing framebuffers
  const w = width;
  const h = height;
  const fboA = createFbo(gl, w, h);
  const fboB = createFbo(gl, w, h);
  const readBuf = new Uint8Array(w * h * 4);
  const maskData = new Uint8Array(w * h);

  // Set once — these never change
  gl.viewport(0, 0, w, h);
  gl.useProgram(morphProg);
  gl.uniform2f(morph.uTexelSize, 1 / w, 1 / h);

  const draw = () => {
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const process = (video: HTMLVideoElement, threshold: number): BinaryMask => {
    const curTex = vidTex[vidIdx];
    const prevTex = vidTex[1 - vidIdx];
    gl.bindTexture(gl.TEXTURE_2D, curTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    vidIdx = 1 - vidIdx;

    if (firstFrame) {
      firstFrame = false;
      maskData.fill(0);
      return { data: maskData, width: w, height: h };
    }

    // Pass 1: frame diff → fboA
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboA.fbo);
    gl.useProgram(diffProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, curTex);
    gl.uniform1i(diff.uCurrent, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.uniform1i(diff.uPrevious, 1);
    gl.uniform1f(diff.uThreshold, threshold / 255);
    draw();

    // Pass 2: erode fboA → fboB
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.fbo);
    gl.useProgram(morphProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboA.tex);
    gl.uniform1i(morph.uMask, 0);
    gl.uniform1i(morph.uErode, 1);
    draw();

    // Pass 3: dilate fboB → fboA
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboA.fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboB.tex);
    gl.uniform1i(morph.uErode, 0);
    draw();

    // Read back mask
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, readBuf);
    for (let i = 0, j = 0; i < maskData.length; i++, j += 4) {
      maskData[i] = readBuf[j] >> 7;
    }

    return { data: maskData, width: w, height: h };
  };

  const dispose = () => {
    gl.deleteProgram(diffProg);
    gl.deleteProgram(morphProg);
    gl.deleteBuffer(buf);
    gl.deleteVertexArray(vao);
    gl.deleteTexture(vidTex[0]);
    gl.deleteTexture(vidTex[1]);
    gl.deleteFramebuffer(fboA.fbo);
    gl.deleteTexture(fboA.tex);
    gl.deleteFramebuffer(fboB.fbo);
    gl.deleteTexture(fboB.tex);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };

  return { process, dispose };
}
