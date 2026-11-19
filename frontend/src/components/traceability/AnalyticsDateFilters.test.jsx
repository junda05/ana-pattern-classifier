import { render, screen } from '@testing-library/react';
import AnalyticsDateFilters from './AnalyticsDateFilters';

describe('AnalyticsDateFilters', () => {
  it('labels both date filters', () => {
    render(
      <AnalyticsDateFilters
        dateFrom=""
        dateTo=""
        onDateFromChange={() => {}}
        onDateToChange={() => {}}
        onGenerate={() => {}}
        isLoading={false}
      />
    );

    expect(screen.getByLabelText('Start Date (Optional)')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('End Date (Optional)')).toHaveAttribute('type', 'date');
  });
});
