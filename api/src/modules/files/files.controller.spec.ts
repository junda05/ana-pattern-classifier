import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

type MockResponse = {
  sendFile: jest.Mock<
    void,
    [string, { headers: Record<string, string> }, ...unknown[]]
  >;
  status: jest.Mock<MockResponse, [number]>;
  json: jest.Mock<MockResponse, [unknown]>;
  headersSent: boolean;
};

function mockResponse(): MockResponse {
  const res: MockResponse = {
    sendFile: jest.fn<
      void,
      [string, { headers: Record<string, string> }, ...unknown[]]
    >(),
    status: jest.fn<MockResponse, [number]>(),
    json: jest.fn<MockResponse, [unknown]>(),
    headersSent: false,
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('FilesController', () => {
  let service: jest.Mocked<
    Pick<
      FilesService,
      'getPredictionImagePath' | 'getReferenceImagePath' | 'getReferenceClasses'
    >
  >;
  let controller: FilesController;
  let res: MockResponse;

  beforeEach(() => {
    service = {
      getPredictionImagePath: jest.fn(),
      getReferenceImagePath: jest.fn(),
      getReferenceClasses: jest.fn(),
    };
    controller = new FilesController(service as unknown as FilesService);
    res = mockResponse();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('servePredictionImage', () => {
    it('sends the file with a private cache policy and the image content type', async () => {
      service.getPredictionImagePath.mockResolvedValueOnce(
        '/abs/predictions/x.png',
      );

      await controller.servePredictionImage(
        'x.png',
        res as unknown as Response,
      );

      const [filePath, options] = res.sendFile.mock.calls[0];
      expect(filePath).toBe('/abs/predictions/x.png');
      expect(options.headers['Content-Type']).toBe('image/png');
      expect(options.headers['Cache-Control']).toMatch(/^private\b/);
    });

    it.each([
      [
        '400 for an invalid file name',
        new BadRequestException('Invalid file name.'),
      ],
      ['404 for a missing image', new NotFoundException('Not found.')],
    ])(
      'propagates %s to the exception layer without sending a file',
      async (_label, error) => {
        service.getPredictionImagePath.mockRejectedValueOnce(error);

        await expect(
          controller.servePredictionImage(
            '../.env',
            res as unknown as Response,
          ),
        ).rejects.toBe(error);
        expect(res.sendFile).not.toHaveBeenCalled();
      },
    );

    it('answers 404 when the file disappears before it is sent', async () => {
      service.getPredictionImagePath.mockResolvedValueOnce(
        '/abs/predictions/x.png',
      );
      res.sendFile.mockImplementationOnce(
        (_path, _options, callback: (err?: Error) => void) =>
          callback(Object.assign(new Error('gone'), { code: 'ENOENT' })),
      );

      await controller.servePredictionImage(
        'x.png',
        res as unknown as Response,
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('serveReferenceImage', () => {
    it('sends the file with a private cache policy (JWT-protected content)', async () => {
      service.getReferenceImagePath.mockResolvedValueOnce(
        '/abs/reference/NUCLEAR/x.jpg',
      );

      await controller.serveReferenceImage(
        'NUCLEAR',
        'x.jpg',
        res as unknown as Response,
      );

      const [, options] = res.sendFile.mock.calls[0];
      expect(options.headers['Content-Type']).toBe('image/jpeg');
      expect(options.headers['Cache-Control']).toMatch(/^private\b/);
    });

    it('propagates service errors to the exception layer', async () => {
      const error = new InternalServerErrorException('boom');
      service.getReferenceImagePath.mockRejectedValueOnce(error);

      await expect(
        controller.serveReferenceImage(
          'NUCLEAR',
          'x.jpg',
          res as unknown as Response,
        ),
      ).rejects.toBe(error);
    });

    it('answers a generic 500 (without internals) when sending fails for another reason', async () => {
      service.getReferenceImagePath.mockResolvedValueOnce(
        '/abs/reference/NUCLEAR/x.jpg',
      );
      res.sendFile.mockImplementationOnce(
        (_path, _options, callback: (err?: Error) => void) =>
          callback(
            Object.assign(new Error('EIO: disk exploded'), { code: 'EIO' }),
          ),
      );

      await controller.serveReferenceImage(
        'NUCLEAR',
        'x.jpg',
        res as unknown as Response,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain(
        'disk exploded',
      );
    });

    it('does not write a second response when headers were already sent', async () => {
      service.getReferenceImagePath.mockResolvedValueOnce(
        '/abs/reference/NUCLEAR/x.jpg',
      );
      res.sendFile.mockImplementationOnce(
        (_path, _options, callback: (err?: Error) => void) => {
          res.headersSent = true;
          callback(
            Object.assign(new Error('aborted'), { code: 'ECONNABORTED' }),
          );
        },
      );

      await controller.serveReferenceImage(
        'NUCLEAR',
        'x.jpg',
        res as unknown as Response,
      );

      expect(res.status).not.toHaveBeenCalled();
    });
  });

  it('returns the reference classes from the service', async () => {
    service.getReferenceClasses.mockResolvedValueOnce([]);

    await expect(controller.getReferenceClasses()).resolves.toEqual([]);
  });
});
