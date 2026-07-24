import { test, expect } from '@playwright/test';

/**
 * Flusso di autenticazione end-to-end contro l'emulatore Firebase (auth +
 * firestore), mai contro il progetto reale. Ogni test usa un'email unica
 * per non dipendere da stato lasciato da run precedenti.
 */

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

test.describe('Registrazione e login', () => {
  test('un nuovo utente può registrarsi ed entrare nella dashboard', async ({ page }) => {
    const email = uniqueEmail('e2e-register');
    const password = 'TestPassword123!';

    await page.goto('/login');
    await page.getByRole('button', { name: 'Registrati' }).click();

    await page.locator('#username').fill('E2E_Tester');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('#confirmPassword').fill(password);
    await page.locator('#terms').check();
    await page.getByRole('button', { name: 'Crea Account' }).click();

    await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 15_000 });
  });

  test('login con credenziali sbagliate mostra un errore e resta sulla pagina di login', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(uniqueEmail('nonexistent'));
    await page.locator('#password').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Entra in Campo' }).click();

    await expect(page.getByText('Email o password non corretti')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('un utente registrato può disconnettersi e tornare al login', async ({ page }) => {
    const email = uniqueEmail('e2e-logout');
    const password = 'TestPassword123!';

    await page.goto('/login');
    await page.getByRole('button', { name: 'Registrati' }).click();
    await page.locator('#username').fill('E2E_Logout');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('#confirmPassword').fill(password);
    await page.locator('#terms').check();
    await page.getByRole('button', { name: 'Crea Account' }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 15_000 });

    await page.getByRole('button', { name: 'Esci dal tuo account' }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

test.describe('Route protette', () => {
  test('un utente non autenticato che visita una pagina protetta viene rimandato al login', async ({ page }) => {
    await page.goto('/schedina');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
