import { INestApplication } from '@nestjs/common';
import { configureApp, trustProxySetting } from './app.setup';

describe('trustProxySetting', () => {
  it.each([undefined, '', '   '])(
    'is undefined when TRUST_PROXY is %p',
    (value) => {
      expect(trustProxySetting(value)).toBeUndefined();
    },
  );

  it.each([
    ['true', true],
    ['false', false],
    ['1', 1],
    ['2', 2],
    ['loopback', 'loopback'],
    ['10.0.0.0/8, 172.16.0.0/12', '10.0.0.0/8, 172.16.0.0/12'],
  ])('maps %p to %p', (value, expected) => {
    expect(trustProxySetting(value)).toBe(expected);
  });
});

describe('configureApp', () => {
  const original = process.env.TRUST_PROXY;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = original;
    }
  });

  function fakeApp() {
    const set = jest.fn();
    const app = {
      use: jest.fn(),
      enableCors: jest.fn(),
      useGlobalPipes: jest.fn(),
      getHttpAdapter: () => ({ getInstance: () => ({ set }) }),
    } as unknown as INestApplication;
    return { app, set };
  }

  it('leaves Express "trust proxy" untouched when TRUST_PROXY is not set', () => {
    delete process.env.TRUST_PROXY;
    const { app, set } = fakeApp();

    configureApp(app);

    expect(set).not.toHaveBeenCalled();
  });

  it('sets Express "trust proxy" from TRUST_PROXY', () => {
    process.env.TRUST_PROXY = '1';
    const { app, set } = fakeApp();

    configureApp(app);

    expect(set).toHaveBeenCalledWith('trust proxy', 1);
  });
});
