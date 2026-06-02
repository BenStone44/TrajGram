export function compileShader(
  gl: WebGL2RenderingContext,
  shaderStr: string,
  shaderType: number
): WebGLShader {
  const shader = gl.createShader(shaderType);
  if (!shader) throw new Error('Create shader error');
  gl.shaderSource(shader, shaderStr);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(shader));
  }

  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertShaderStr: string,
  fragShaderStr: string
): WebGLProgram {
  const vertShader = compileShader(gl, vertShaderStr, gl.VERTEX_SHADER);
  const fragShader = compileShader(gl, fragShaderStr, gl.FRAGMENT_SHADER);

  const program = gl.createProgram();
  if (!program) throw new Error('Create program error');

  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);

  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Could not link shaders: ${gl.getProgramInfoLog(program)}`);
  }

  return program;
}

export function createArrayBuffer(
  gl: WebGL2RenderingContext,
  data: Float32Array
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('Create buffer error');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  return buffer;
}
