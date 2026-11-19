import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dropzone from './Dropzone';

const image = (name) => new File(['x'], name, { type: 'image/png' });

describe('Dropzone', () => {
  it('keeps the file input visually hidden but focusable and labelled', async () => {
    const user = userEvent.setup();
    render(<Dropzone onFilesSelect={() => {}} />);

    const input = screen.getByLabelText('Select Files');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveClass('sr-only');
    expect(input).not.toHaveClass('hidden');

    await user.tab();
    expect(input).toHaveFocus();
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('opens the file picker with %s', async (_key, keys) => {
    const user = userEvent.setup();
    render(<Dropzone onFilesSelect={() => {}} />);
    const input = screen.getByLabelText('Select Files');
    const click = jest.spyOn(input, 'click');

    await user.tab();
    await user.keyboard(keys);

    expect(click).toHaveBeenCalled();
  });

  it('passes the chosen files on and announces how many were selected', async () => {
    const user = userEvent.setup();
    const onFilesSelect = jest.fn();
    render(<Dropzone onFilesSelect={onFilesSelect} />);

    await user.upload(screen.getByLabelText('Select Files'), [image('a.png'), image('b.png')]);

    expect(onFilesSelect).toHaveBeenCalledWith([expect.any(File), expect.any(File)]);
    expect(screen.getByRole('status')).toHaveTextContent('2 images selected.');
  });
});

describe('Dropzone accepted types and disabled state', () => {
  const textFile = (name) => new File(['x'], name, { type: 'text/plain' });
  const drop = (files) => fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer: { files } });

  it('applies the accepted types to dropped files and explains what was skipped', () => {
    const onFilesSelect = jest.fn();
    render(<Dropzone onFilesSelect={onFilesSelect} acceptedFiles="image/*" />);

    drop([image('a.png'), textFile('notes.txt')]);

    expect(onFilesSelect).toHaveBeenCalledWith([expect.objectContaining({ name: 'a.png' })]);
    expect(screen.getByRole('alert')).toHaveTextContent('notes.txt is not a supported file type.');
  });

  it('does not call back when every dropped file is rejected', () => {
    const onFilesSelect = jest.fn();
    render(<Dropzone onFilesSelect={onFilesSelect} acceptedFiles="image/*,.tif" />);

    drop([textFile('a.txt'), textFile('b.csv')]);

    expect(onFilesSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('a.txt and b.csv are not supported file types.');
  });

  it('accepts files by extension when the accept list names one', () => {
    const onFilesSelect = jest.fn();
    render(<Dropzone onFilesSelect={onFilesSelect} acceptedFiles=".tif" />);

    drop([new File(['x'], 'scan.TIF', { type: '' })]);

    expect(onFilesSelect).toHaveBeenCalledWith([expect.objectContaining({ name: 'scan.TIF' })]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores drops and disables the picker while disabled', () => {
    const onFilesSelect = jest.fn();
    render(<Dropzone onFilesSelect={onFilesSelect} disabled />);

    drop([image('a.png')]);

    expect(onFilesSelect).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Select Files')).toBeDisabled();
  });
});
