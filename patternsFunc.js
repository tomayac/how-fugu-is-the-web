import patterns from './patterns.mjs';

const patternsFunc = async () => {
  const result = {};
  for await (const [key, value] of Object.entries(patterns)) {
    result[key] = await value.supported;
  }
  return result;
};

export default patternsFunc;
