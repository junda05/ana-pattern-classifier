import {
  apiBaseUrl,
  DEFAULT_API_BASE_URL,
  predictionImageUrl,
} from './api-base-url';

describe('api-base-url', () => {
  const original = process.env.API_BASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.API_BASE_URL;
    } else {
      process.env.API_BASE_URL = original;
    }
  });

  describe('apiBaseUrl', () => {
    it('defaults to http://localhost:8001 when API_BASE_URL is unset', () => {
      delete process.env.API_BASE_URL;
      expect(DEFAULT_API_BASE_URL).toBe('http://localhost:8001');
      expect(apiBaseUrl()).toBe('http://localhost:8001');
    });

    it('defaults when API_BASE_URL is blank', () => {
      process.env.API_BASE_URL = '   ';
      expect(apiBaseUrl()).toBe('http://localhost:8001');
    });

    it('uses API_BASE_URL and strips trailing slashes', () => {
      process.env.API_BASE_URL = 'https://api.example.com/';
      expect(apiBaseUrl()).toBe('https://api.example.com');
    });
  });

  describe('predictionImageUrl', () => {
    it('builds the protected files route for a stored image name', () => {
      process.env.API_BASE_URL = 'https://api.example.com';
      expect(predictionImageUrl('abc-123-slide.png')).toBe(
        'https://api.example.com/api/v1/files/predictions/abc-123-slide.png',
      );
    });

    it('encodes characters that are not URL-safe', () => {
      delete process.env.API_BASE_URL;
      expect(predictionImageUrl('abc-123-my slide #1.png')).toBe(
        'http://localhost:8001/api/v1/files/predictions/abc-123-my%20slide%20%231.png',
      );
    });

    it('returns undefined when there is no image path', () => {
      expect(predictionImageUrl(undefined)).toBeUndefined();
      expect(predictionImageUrl(null)).toBeUndefined();
      expect(predictionImageUrl('')).toBeUndefined();
    });
  });
});
