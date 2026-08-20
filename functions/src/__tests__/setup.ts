// Ambiente dei test di integrazione: puntano SEMPRE all'emulatore.
//
// `FIRESTORE_EMULATOR_HOST` è ciò che dirotta l'Admin SDK; il project id è
// volutamente diverso da quello reale, così anche in caso di errore di
// configurazione non si può scrivere sul progetto di produzione.
process.env.GCLOUD_PROJECT ??= 'fantaschedina-itest';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'FIRESTORE_EMULATOR_HOST non impostato: i test di integrazione non devono ' +
      'mai girare contro Firestore reale. Usa `npm run test:integration`.'
  );
}
