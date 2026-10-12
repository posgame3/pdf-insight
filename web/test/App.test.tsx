import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { InsightView } from '../src/components/insight/InsightView';
import { saveToHistory } from '../src/lib/history';
import { insightFixture } from './fixtures';

describe('App', () => {
  it('shows the upload area and tells the user where the file goes before upload', () => {
    render(<App />);
    expect(screen.getByLabelText(/przeciągnij plik pdf/i)).toHaveAttribute('type', 'file');
    expect(screen.getByText(/modelu\s+claude firmy anthropic/i)).toBeInTheDocument();
  });

  it('rejects a file that is not a PDF with a visible, announced message', async () => {
    render(<App />);
    await userEvent.upload(screen.getByLabelText(/przeciągnij plik pdf/i), new File(['hello'], 'notes.pdf'), {
      applyAccept: false,
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('To nie jest plik PDF');
  });

  it('reopens a result from the local history', async () => {
    saveToHistory(insightFixture());
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /umowa 14\/2026\.pdf/i }));
    expect(screen.getByRole('heading', { level: 2, name: 'Umowa ramowa nr 14/2026' })).toBeInTheDocument();
  });
});

describe('InsightView', () => {
  it('presents verified values, warnings and the hidden text that was removed', () => {
    render(<InsightView insight={insightFixture()} durationMs={12_400} onReset={() => undefined} />);

    const amounts = screen.getByRole('region', { name: 'Kwoty' });
    expect(within(amounts).getByText(/^184\s500,00\s*zł$/)).toHaveClass('evidence-value');
    expect(within(amounts).getByText('Potwierdzone')).toBeInTheDocument();
    expect(within(amounts).getByText('Ze skanu')).toBeInTheDocument();

    expect(screen.getByText('Ukryty tekst')).toBeInTheDocument();
    expect(screen.getByText('Zmiana warunków (aneks)')).toBeInTheDocument();
    expect(screen.getByText(/INSTRUKCJA DLA SYSTEMU AI/, { selector: 'q' })).toBeInTheDocument();
    expect(screen.getByText('12,4 s')).toBeInTheDocument();
  });

  it('renders document text as plain text, never as HTML', () => {
    const insight = insightFixture({ summary: '<img src=x onerror=alert(1)>Pierwsze. Drugie zdanie. Trzecie zdanie.' });
    const { container } = render(<InsightView insight={insight} durationMs={null} onReset={() => undefined} />);
    expect(container.querySelector('img')).toBeNull();
    const summary = screen.getByRole('region', { name: 'Podsumowanie' });
    expect(within(summary).getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
  });

  it('moves focus to the result heading for keyboard and screen-reader users', () => {
    render(<InsightView insight={insightFixture()} durationMs={null} onReset={() => undefined} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
  });
});
