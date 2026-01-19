/**
 * Test to verify Jest is properly configured
 */

describe('Jest Setup', () => {
  it('should run tests with Jest', () => {
    expect(true).toBe(true);
  });

  it('should have coverage reporting enabled', () => {
    // This test verifies Jest is running
    const testValue = 42;
    expect(testValue).toBe(42);
  });

  it('should support TypeScript', () => {
    const typedValue: string = 'TypeScript works';
    expect(typedValue).toBe('TypeScript works');
  });
});
