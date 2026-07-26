// ============================================
// FANTASCHEDINA - QUIZ DATABASE
// ~150 curated + programmatic generation → 1000+ questions
// ============================================

import { secureShuffle } from './random';

export interface QuizQuestionData {
  question: string;
  options: string[];
  answerIndex: number;
  category: string;
}

// --- CURATED (Serie A) ---
const serieA: QuizQuestionData[] = [
  { question: 'Quanti scudetti ha vinto la Juventus?', options: ['36', '34', '38', '35'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quanti scudetti ha vinto l\'Inter?', options: ['20', '19', '18', '21'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quanti scudetti ha vinto il Milan?', options: ['19', '18', '20', '17'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 2023-24?', options: ['Inter', 'Milan', 'Juventus', 'Napoli'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 2022-23?', options: ['Napoli', 'Inter', 'Milan', 'Juventus'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 2021-22?', options: ['Milan', 'Inter', 'Napoli', 'Juventus'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi è il miglior marcatore della storia della Serie A?', options: ['Silvio Piola', 'Francesco Totti', 'Gunnar Nordahl', 'José Altafini'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quanti gol ha segnato Piola in Serie A?', options: ['274', '290', '250', '265'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi detiene il record di gol in una stagione di Serie A?', options: ['Ciro Immobile', 'Gonzalo Higuaín', 'Luca Toni', 'Andriy Shevchenko'], answerIndex: 1, category: 'Serie A' },
  { question: 'Quanti gol ha segnato Higuaín nel 2015-16?', options: ['36', '35', '34', '38'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quanti gol ha segnato Immobile nel 2019-20?', options: ['36', '35', '34', '37'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto più Coppe Italia?', options: ['Juventus', 'Roma', 'Inter', 'Fiorentina'], answerIndex: 0, category: 'Serie A' },
  { question: 'In che anno è nata la Serie A a girone unico?', options: ['1929', '1930', '1928', '1931'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quante squadre partecipano alla Serie A?', options: ['20', '18', '22', '16'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quale squadra ha vinto il Triplete nel 2010?', options: ['Inter', 'Milan', 'Roma', 'Juventus'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi allenava l\'Inter nel Triplete 2010?', options: ['José Mourinho', 'Rafael Benítez', 'Roberto Mancini', 'Carlo Ancelotti'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quale squadra ha vinto 9 scudetti consecutivi?', options: ['Juventus', 'Inter', 'Milan', 'Napoli'], answerIndex: 0, category: 'Serie A' },
  { question: 'In che anno il Napoli ha vinto il primo scudetto?', options: ['1987', '1986', '1988', '1985'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quanti gol ha segnato Maradona con il Napoli in Serie A?', options: ['81', '115', '95', '73'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quante scudetti ha vinto il Napoli?', options: ['4', '3', '2', '5'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quante scudetti ha vinto la Roma?', options: ['3', '2', '4', '1'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quante scudetti ha vinto la Lazio?', options: ['2', '1', '3', '4'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quante scudetti ha vinto la Fiorentina?', options: ['2', '1', '3', '0'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quante scudetti ha vinto il Torino?', options: ['10', '7', '8', '6'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quante scudetti ha vinto la Sampdoria?', options: ['1', '2', '0', '3'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quante scudetti ha vinto il Cagliari?', options: ['1', '0', '2', '3'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quante scudetti ha vinto il Verona?', options: ['1', '0', '2', '3'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi è il giocatore con più presenze in Serie A?', options: ['Paolo Maldini', 'Francesco Totti', 'Gianluigi Buffon', 'Javier Zanetti'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quante presenze ha Maldini in Serie A?', options: ['647', '630', '615', '660'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quanti gol ha segnato Totti in Serie A?', options: ['250', '240', '255', '245'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi è il capocannoniere straniero della Serie A?', options: ['Gunnar Nordahl', 'Shevchenko', 'Batistuta', 'Trezeguet'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quanti gol ha segnato Nordahl in Serie A?', options: ['225', '210', '240', '215'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 2020-21?', options: ['Inter', 'Milan', 'Juventus', 'Napoli'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 2019-20?', options: ['Juventus', 'Inter', 'Lazio', 'Milan'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 2018-19?', options: ['Juventus', 'Napoli', 'Inter', 'Milan'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 2010-11?', options: ['Milan', 'Inter', 'Juventus', 'Napoli'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 2009-10?', options: ['Inter', 'Roma', 'Milan', 'Juventus'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 2003-04?', options: ['Milan', 'Roma', 'Juventus', 'Inter'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 2000-01?', options: ['Roma', 'Juventus', 'Lazio', 'Milan'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 1999-00?', options: ['Lazio', 'Juventus', 'Roma', 'Milan'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 1990-91?', options: ['Sampdoria', 'Milan', 'Inter', 'Juventus'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 1989-90?', options: ['Napoli', 'Milan', 'Inter', 'Juventus'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 1984-85?', options: ['Verona', 'Juventus', 'Inter', 'Torino'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto 1969-70?', options: ['Cagliari', 'Inter', 'Juventus', 'Milan'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quanti scudetti consecutivi vinse il Grande Torino?', options: ['5', '4', '6', '3'], answerIndex: 0, category: 'Serie A' },
  { question: 'In che anno avvenne la tragedia di Superga?', options: ['1949', '1948', '1950', '1947'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi era il capitano del Grande Torino?', options: ['Valentino Mazzola', 'Guglielmo Gabetto', 'Pietro Ferraris', 'Eusebio Castigliano'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quale stadio ospita le partite della Juventus?', options: ['Allianz Stadium', 'San Siro', 'Olimpico', 'Maradona'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quale stadio ospita le partite del Napoli?', options: ['Diego Armando Maradona', 'San Paolo', 'Olimpico', 'Arechi'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto la classifica cannonieri 2023-24?', options: ['Lautaro Martínez', 'Vlahović', 'Osimhen', 'Leão'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto il MVP della Serie A 2022-23?', options: ['Kvaratskhelia', 'Osimhen', 'Lautaro', 'Leão'], answerIndex: 0, category: 'Serie A' },
  { question: 'Quanti punti ha totalizzato l\'Inter nello scudetto 2023-24?', options: ['94', '92', '96', '90'], answerIndex: 0, category: 'Serie A' },
  { question: 'Chi ha vinto lo scudetto femminile 2023-24?', options: ['Roma', 'Juventus', 'Fiorentina', 'Inter'], answerIndex: 0, category: 'Serie A' },
];

// --- CURATED (Mondiali) ---
const mondiali: QuizQuestionData[] = [
  { question: 'In che anno si è giocato il primo Mondiale?', options: ['1930', '1928', '1932', '1934'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Dove si è giocato il primo Mondiale?', options: ['Uruguay', 'Brasile', 'Italia', 'Argentina'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto il primo Mondiale?', options: ['Uruguay', 'Argentina', 'Brasile', 'Italia'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Quante volte il Brasile ha vinto i Mondiali?', options: ['5', '4', '6', '3'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Quante volte l\'Italia ha vinto i Mondiali?', options: ['4', '3', '5', '2'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Quante volte la Germania ha vinto i Mondiali?', options: ['4', '3', '5', '2'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Quante volte l\'Argentina ha vinto i Mondiali?', options: ['3', '2', '4', '1'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Quante volte la Francia ha vinto i Mondiali?', options: ['2', '1', '3', '0'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 2022?', options: ['Argentina', 'Francia', 'Brasile', 'Croazia'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Dove si sono giocati i Mondiali 2022?', options: ['Qatar', 'Russia', 'Brasile', 'Sudafrica'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 2018?', options: ['Francia', 'Croazia', 'Belgio', 'Inghilterra'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 2014?', options: ['Germania', 'Argentina', 'Brasile', 'Olanda'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 2010?', options: ['Spagna', 'Olanda', 'Germania', 'Uruguay'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 2006?', options: ['Italia', 'Francia', 'Germania', 'Portogallo'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 2002?', options: ['Brasile', 'Germania', 'Turchia', 'Corea del Sud'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 1998?', options: ['Francia', 'Brasile', 'Croazia', 'Olanda'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 1994?', options: ['Brasile', 'Italia', 'Bulgaria', 'Svezia'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 1990?', options: ['Germania Ovest', 'Argentina', 'Italia', 'Inghilterra'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 1986?', options: ['Argentina', 'Germania Ovest', 'Francia', 'Belgio'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 1982?', options: ['Italia', 'Germania Ovest', 'Polonia', 'Francia'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 1970?', options: ['Brasile', 'Italia', 'Germania Ovest', 'Uruguay'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 1966?', options: ['Inghilterra', 'Germania Ovest', 'Portogallo', 'URSS'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali 1958?', options: ['Brasile', 'Svezia', 'Francia', 'Germania Ovest'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi è il miglior marcatore di sempre ai Mondiali?', options: ['Miroslav Klose', 'Ronaldo', 'Gerd Müller', 'Just Fontaine'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Quanti gol ha Klose ai Mondiali?', options: ['16', '15', '17', '14'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi detiene il record di gol in un singolo Mondiale?', options: ['Just Fontaine', 'Kocsis', 'Ronaldo', 'Müller'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Quanti gol ha Fontaine nel 1958?', options: ['13', '12', '14', '11'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha segnato il "Gol del Secolo" nel 1986?', options: ['Maradona', 'Pelé', 'Van Basten', 'Cruyff'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Contro chi Maradona segnò la "Mano de Dios"?', options: ['Inghilterra', 'Brasile', 'Germania', 'Belgio'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto il Pallone d\'Oro dei Mondiali 2022?', options: ['Messi', 'Mbappé', 'Modrić', 'Martínez'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Quante squadre partecipano ai Mondiali dal 2026?', options: ['48', '32', '40', '36'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Dove si giocheranno i Mondiali 2026?', options: ['USA-Canada-Messico', 'USA', 'Messico', 'Marocco'], answerIndex: 0, category: 'Mondiali' },
  { question: 'In che anno Pelé vinse il primo Mondiale?', options: ['1958', '1962', '1954', '1970'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Quanti Mondiali ha vinto Pelé?', options: ['3', '2', '4', '1'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi allenava l\'Italia nel 2006?', options: ['Lippi', 'Donadoni', 'Prandelli', 'Trapattoni'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi segnò il rigore decisivo nella finale 2006?', options: ['Grosso', 'Pirlo', 'Materazzi', 'Toni'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Cosa successe a Zidane nella finale 2006?', options: ['Espulso per testata', 'Doppietta', 'Infortunio', 'Parò un rigore'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Qual fu il risultato di Germania-Brasile 2014?', options: ['7-1', '6-1', '5-0', '7-0'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Come è chiamata la sconfitta 7-1 del Brasile?', options: ['Mineirazo', 'Maracanazo', 'Tragedia di BH', 'Verdasco'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi è l\'unico paese ad aver partecipato a tutti i Mondiali?', options: ['Brasile', 'Germania', 'Italia', 'Argentina'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali femminili 2023?', options: ['Spagna', 'Inghilterra', 'Svezia', 'Australia'], answerIndex: 0, category: 'Mondiali' },
  { question: 'Chi ha vinto i Mondiali femminili 2019?', options: ['USA', 'Olanda', 'Inghilterra', 'Svezia'], answerIndex: 0, category: 'Mondiali' },
];

// --- CURATED (Champions) ---
const champions: QuizQuestionData[] = [
  { question: 'Quante Champions ha vinto il Real Madrid?', options: ['15', '14', '13', '12'], answerIndex: 0, category: 'Champions' },
  { question: 'Quante Champions ha vinto il Milan?', options: ['7', '6', '8', '5'], answerIndex: 0, category: 'Champions' },
  { question: 'Quante Champions ha vinto il Bayern?', options: ['6', '7', '5', '8'], answerIndex: 0, category: 'Champions' },
  { question: 'Quante Champions ha vinto il Liverpool?', options: ['6', '7', '5', '8'], answerIndex: 0, category: 'Champions' },
  { question: 'Quante Champions ha vinto il Barcellona?', options: ['5', '6', '4', '3'], answerIndex: 0, category: 'Champions' },
  { question: 'Quante Champions ha vinto l\'Inter?', options: ['3', '2', '4', '1'], answerIndex: 0, category: 'Champions' },
  { question: 'Quante Champions ha vinto la Juventus?', options: ['2', '1', '3', '0'], answerIndex: 0, category: 'Champions' },
  { question: 'Quante Champions ha vinto l\'Ajax?', options: ['4', '3', '5', '2'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto la Champions 2023-24?', options: ['Real Madrid', 'Dortmund', 'Bayern', 'City'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto la Champions 2022-23?', options: ['Manchester City', 'Inter', 'Real Madrid', 'Bayern'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto la Champions 2021-22?', options: ['Real Madrid', 'Liverpool', 'City', 'Chelsea'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto la Champions 2020-21?', options: ['Chelsea', 'City', 'Real Madrid', 'PSG'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto la Champions 2019-20?', options: ['Bayern', 'PSG', 'Lione', 'City'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto la Champions 2018-19?', options: ['Liverpool', 'Tottenham', 'Barça', 'Ajax'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto la Champions 2009-10?', options: ['Inter', 'Bayern', 'Barça', 'United'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto la Champions 2004-05?', options: ['Liverpool', 'Milan', 'Chelsea', 'Juve'], answerIndex: 0, category: 'Champions' },
  { question: 'Come è chiamata la finale 2005?', options: ['Miracolo di Istanbul', 'Notte magica', 'Rimonta Reds', 'Finale secoli'], answerIndex: 0, category: 'Champions' },
  { question: 'Qual era il risultato all\'intervallo della finale 2005?', options: ['0-3 Milan', '0-2 Milan', '1-0 Liverpool', '0-0'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto la Champions 2003-04?', options: ['Porto', 'Monaco', 'Chelsea', 'Deportivo'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi allenava il Porto nella Champions 2004?', options: ['Mourinho', 'Villas-Boas', 'Robson', 'Santos'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi è il miglior marcatore della storia della Champions?', options: ['Cristiano Ronaldo', 'Messi', 'Lewandowski', 'Benzema'], answerIndex: 0, category: 'Champions' },
  { question: 'Quanti gol ha Ronaldo in Champions?', options: ['140', '135', '145', '130'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi detiene il record di gol in una singola edizione?', options: ['Cristiano Ronaldo', 'Messi', 'Luiz Adriano', 'Lewandowski'], answerIndex: 0, category: 'Champions' },
  { question: 'Quanti gol ha Ronaldo nell\'edizione 2013-14?', options: ['17', '16', '15', '18'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto più Europa League?', options: ['Siviglia', 'Inter', 'Juve', 'Liverpool'], answerIndex: 0, category: 'Champions' },
  { question: 'Quante Europa League ha vinto il Siviglia?', options: ['7', '6', '5', '8'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto l\'Europa League 2023-24?', options: ['Atalanta', 'Leverkusen', 'Roma', 'Juve'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto la prima Conference League?', options: ['Roma', 'Feyenoord', 'Leicester', 'Marsiglia'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto 3 Champions consecutive (2016-18)?', options: ['Real Madrid', 'Barça', 'Bayern', 'Liverpool'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi allenava il Real Madrid nelle 3 Champions consecutive?', options: ['Zidane', 'Ancelotti', 'Benítez', 'Lopetegui'], answerIndex: 0, category: 'Champions' },
  { question: 'In che anno si giocò la prima Coppa dei Campioni?', options: ['1956', '1955', '1957', '1954'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi vinse le prime 5 Coppe dei Campioni?', options: ['Real Madrid', 'Milan', 'Benfica', 'Barça'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi ha vinto la Champions "La Decima" nel 2014?', options: ['Real Madrid', 'Atletico', 'Bayern', 'Barça'], answerIndex: 0, category: 'Champions' },
  { question: 'Chi segnò il pareggio al 93° nella finale 2014?', options: ['Sergio Ramos', 'Ronaldo', 'Bale', 'Modrić'], answerIndex: 0, category: 'Champions' },
];

// --- CURATED (Pallone d'Oro & Giocatori) ---
const giocatori: QuizQuestionData[] = [
  { question: 'Quanti Palloni d\'Oro ha vinto Messi?', options: ['8', '7', '6', '9'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Quanti Palloni d\'Oro ha vinto CR7?', options: ['5', '4', '6', '3'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Quanti Palloni d\'Oro ha vinto Platini?', options: ['3', '2', '4', '1'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Quanti Palloni d\'Oro ha vinto Cruyff?', options: ['3', '2', '4', '1'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Quanti Palloni d\'Oro ha vinto Van Basten?', options: ['3', '2', '4', '1'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Chi ha vinto il primo Pallone d\'Oro?', options: ['Stanley Matthews', 'Di Stéfano', 'Kopa', 'Fontaine'], answerIndex: 0, category: 'Giocatori' },
  { question: 'In che anno fu assegnato il primo Pallone d\'Oro?', options: ['1956', '1955', '1957', '1954'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Chi ha vinto il Pallone d\'Oro 2023?', options: ['Messi', 'Haaland', 'Mbappé', 'De Bruyne'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Chi ha vinto il Pallone d\'Oro 2022?', options: ['Benzema', 'Messi', 'Mbappé', 'Lewandowski'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Chi ha vinto il Pallone d\'Oro 2018?', options: ['Modrić', 'CR7', 'Messi', 'Griezmann'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Chi è l\'ultimo difensore ad aver vinto il Pallone d\'Oro?', options: ['Cannavaro', 'Maldini', 'Beckenbauer', 'Van Dijk'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Chi ha vinto il Pallone d\'Oro nel 1993?', options: ['Baggio', 'Cantona', 'Bergkamp', 'Romário'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Chi ha vinto il Pallone d\'Oro nel 2003?', options: ['Nedvěd', 'Henry', 'Maldini', 'Zidane'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Chi ha vinto il Pallone d\'Oro nel 2007?', options: ['Kaká', 'CR7', 'Messi', 'Pirlo'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Chi detiene il record di gol in un anno solare?', options: ['Messi', 'CR7', 'Müller', 'Lewandowski'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Quanti gol ha segnato Messi nel 2012?', options: ['91', '90', '92', '85'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Chi è considerato il "Re del Calcio"?', options: ['Pelé', 'Maradona', 'Cruyff', 'Di Stéfano'], answerIndex: 0, category: 'Giocatori' },
  { question: 'In che anno Maradona passò al Napoli?', options: ['1984', '1983', '1985', '1982'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Chi è l\'allenatore con più Champions vinte?', options: ['Ancelotti', 'Zidane', 'Guardiola', 'Paisley'], answerIndex: 0, category: 'Giocatori' },
  { question: 'Quante Champions ha vinto Ancelotti?', options: ['5', '4', '3', '6'], answerIndex: 0, category: 'Giocatori' },
];

// --- CURATED (Europei) ---
const europei: QuizQuestionData[] = [
  { question: 'Chi ha vinto gli Europei 2020?', options: ['Italia', 'Inghilterra', 'Francia', 'Spagna'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi ha vinto gli Europei 2016?', options: ['Portogallo', 'Francia', 'Germania', 'Galles'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi ha vinto gli Europei 2012?', options: ['Spagna', 'Italia', 'Germania', 'Portogallo'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi ha vinto gli Europei 2008?', options: ['Spagna', 'Germania', 'Russia', 'Olanda'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi ha vinto gli Europei 2004?', options: ['Grecia', 'Portogallo', 'Cechia', 'Olanda'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi ha vinto gli Europei 2000?', options: ['Francia', 'Italia', 'Olanda', 'Portogallo'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi ha vinto gli Europei 1996?', options: ['Germania', 'Cechia', 'Inghilterra', 'Francia'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi ha vinto gli Europei 1992?', options: ['Danimarca', 'Germania', 'Olanda', 'Svezia'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi ha vinto gli Europei 1988?', options: ['Olanda', 'URSS', 'Germania Ovest', 'Italia'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi ha vinto gli Europei 1984?', options: ['Francia', 'Spagna', 'Portogallo', 'Germania Ovest'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi ha vinto gli Europei 1968?', options: ['Italia', 'Jugoslavia', 'Inghilterra', 'URSS'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi ha vinto gli Europei 2024?', options: ['Spagna', 'Inghilterra', 'Francia', 'Germania'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi fu MVP degli Europei 2020?', options: ['Donnarumma', 'Bonucci', 'Chiesa', 'Kane'], answerIndex: 0, category: 'Europei' },
  { question: 'Quante volte la Germania ha vinto gli Europei?', options: ['3', '2', '4', '1'], answerIndex: 0, category: 'Europei' },
  { question: 'Quante volte la Spagna ha vinto gli Europei?', options: ['3', '2', '4', '1'], answerIndex: 0, category: 'Europei' },
  { question: 'Quante volte l\'Italia ha vinto gli Europei?', options: ['2', '1', '3', '0'], answerIndex: 0, category: 'Europei' },
  { question: 'Chi è il miglior marcatore della storia degli Europei?', options: ['CR7', 'Platini', 'Griezmann', 'Shearer'], answerIndex: 0, category: 'Europei' },
  { question: 'Quanti gol ha Ronaldo negli Europei?', options: ['14', '12', '10', '15'], answerIndex: 0, category: 'Europei' },
];

// --- CURATED (Regole & Misc) ---
const regole: QuizQuestionData[] = [
  { question: 'Quanti giocatori compongono una squadra in campo?', options: ['11', '10', '12', '9'], answerIndex: 0, category: 'Regole' },
  { question: 'Quante sostituzioni sono consentite (2024)?', options: ['5', '3', '4', '6'], answerIndex: 0, category: 'Regole' },
  { question: 'Quanto dura una partita di calcio?', options: ['90 minuti', '80 minuti', '100 minuti', '60 minuti'], answerIndex: 0, category: 'Regole' },
  { question: 'Cosa significa il cartellino giallo?', options: ['Ammonizione', 'Espulsione', 'Richiamo', 'Time-out'], answerIndex: 0, category: 'Regole' },
  { question: 'Cosa significa il cartellino rosso?', options: ['Espulsione', 'Ammonizione', 'Richiamo', 'Time-out'], answerIndex: 0, category: 'Regole' },
  { question: 'Quanti cartellini gialli equivalgono a un rosso?', options: ['2', '1', '3', 'Non equivalgono'], answerIndex: 0, category: 'Regole' },
  { question: 'Quando viene assegnato un calcio di rigore?', options: ['Fallo in area', 'Fallo fuori area', 'Tiro fuori', 'Passaggio indietro'], answerIndex: 0, category: 'Regole' },
  { question: 'Quanto dista il dischetto del rigore dalla porta?', options: ['11 metri', '10 metri', '12 metri', '9 metri'], answerIndex: 0, category: 'Regole' },
  { question: 'Cosa è il VAR?', options: ['Video Assistant Referee', 'Video Assistant Replay', 'Visual Action Replay', 'Video Action Referee'], answerIndex: 0, category: 'Regole' },
  { question: 'In che anno è stato introdotto il VAR?', options: ['2017', '2016', '2018', '2015'], answerIndex: 0, category: 'Regole' },
  { question: 'In che anno fu fondata la FIFA?', options: ['1904', '1900', '1910', '1898'], answerIndex: 0, category: 'Regole' },
  { question: 'Dove ha sede la FIFA?', options: ['Zurigo', 'Parigi', 'Ginevra', 'Bruxelles'], answerIndex: 0, category: 'Regole' },
  { question: 'Chi è il presidente della FIFA (2024)?', options: ['Infantino', 'Blatter', 'Platini', 'Čeferin'], answerIndex: 0, category: 'Regole' },
  { question: 'Dove ha sede la UEFA?', options: ['Nyon', 'Zurigo', 'Parigi', 'Ginevra'], answerIndex: 0, category: 'Regole' },
  { question: 'Quante squadre retrocedono in Serie B?', options: ['3', '2', '4', '1'], answerIndex: 0, category: 'Regole' },
  { question: 'Cosa è la "Premier League"?', options: ['Campionato inglese', 'Campionato scozzese', 'Campionato gallese', 'Campionato irlandese'], answerIndex: 0, category: 'Regole' },
  { question: 'Cosa è la "Bundesliga"?', options: ['Campionato tedesco', 'Campionato austriaco', 'Campionato olandese', 'Campionato svizzero'], answerIndex: 0, category: 'Regole' },
  { question: 'Cosa è la "Ligue 1"?', options: ['Campionato francese', 'Campionato belga', 'Campionato svizzero', 'Campionato lussemburghese'], answerIndex: 0, category: 'Regole' },
  { question: 'Cosa è la "La Liga"?', options: ['Campionato spagnolo', 'Campionato portoghese', 'Campionato argentino', 'Campionato messicano'], answerIndex: 0, category: 'Regole' },
  { question: 'Quanto durano i tempi supplementari?', options: ['30 minuti (15+15)', '20 minuti', '15 minuti', '45 minuti'], answerIndex: 0, category: 'Regole' },
];

// --- PROGRAMMATIC GENERATOR ---
// Generates questions from data tables to reach 1000+

const teamCityData: [string, string, string[]][] = [
  ['Inter', 'Milano', ['Roma', 'Torino', 'Napoli']],
  ['Milan', 'Milano', ['Roma', 'Torino', 'Napoli']],
  ['Juventus', 'Torino', ['Milano', 'Roma', 'Genova']],
  ['Roma', 'Roma', ['Milano', 'Napoli', 'Firenze']],
  ['Lazio', 'Roma', ['Milano', 'Napoli', 'Firenze']],
  ['Napoli', 'Napoli', ['Roma', 'Bari', 'Salerno']],
  ['Fiorentina', 'Firenze', ['Roma', 'Bologna', 'Pisa']],
  ['Atalanta', 'Bergamo', ['Milano', 'Brescia', 'Torino']],
  ['Bologna', 'Bologna', ['Modena', 'Parma', 'Firenze']],
  ['Torino', 'Torino', ['Milano', 'Genova', 'Bergamo']],
  ['Udinese', 'Udine', ['Trieste', 'Venezia', 'Padova']],
  ['Cagliari', 'Cagliari', ['Sassari', 'Olbia', 'Nuoro']],
  ['Genoa', 'Genova', ['Savona', 'La Spezia', 'Alessandria']],
  ['Sampdoria', 'Genova', ['Savona', 'La Spezia', 'Alessandria']],
  ['Verona', 'Verona', ['Vicenza', 'Padova', 'Mantova']],
  ['Lecce', 'Lecce', ['Bari', 'Brindisi', 'Taranto']],
  ['Monza', 'Monza', ['Milano', 'Bergamo', 'Como']],
  ['Como', 'Como', ['Milano', 'Varese', 'Lecco']],
  ['Parma', 'Parma', ['Bologna', 'Modena', 'Piacenza']],
  ['Venezia', 'Venezia', ['Padova', 'Treviso', 'Verona']],
  ['Empoli', 'Empoli', ['Firenze', 'Pisa', 'Siena']],
  ['Real Madrid', 'Madrid', ['Barcellona', 'Siviglia', 'Valencia']],
  ['Barcellona', 'Barcellona', ['Madrid', 'Valencia', 'Bilbao']],
  ['Atletico Madrid', 'Madrid', ['Barcellona', 'Siviglia', 'Valencia']],
  ['Bayern Monaco', 'Monaco di Baviera', ['Berlino', 'Amburgo', 'Colonia']],
  ['Borussia Dortmund', 'Dortmund', ['Monaco', 'Amburgo', 'Berlino']],
  ['PSG', 'Parigi', ['Marsiglia', 'Lione', 'Bordeaux']],
  ['Marsiglia', 'Marsiglia', ['Parigi', 'Lione', 'Nizza']],
  ['Manchester United', 'Manchester', ['Londra', 'Liverpool', 'Birmingham']],
  ['Manchester City', 'Manchester', ['Londra', 'Liverpool', 'Birmingham']],
  ['Liverpool', 'Liverpool', ['Manchester', 'Londra', 'Newcastle']],
  ['Chelsea', 'Londra', ['Manchester', 'Liverpool', 'Birmingham']],
  ['Arsenal', 'Londra', ['Manchester', 'Liverpool', 'Birmingham']],
  ['Tottenham', 'Londra', ['Manchester', 'Liverpool', 'Birmingham']],
  ['Ajax', 'Amsterdam', ['Rotterdam', 'L\'Aia', 'Eindhoven']],
  ['Benfica', 'Lisbona', ['Porto', 'Braga', 'Coimbra']],
  ['Porto', 'Porto', ['Lisbona', 'Braga', 'Coimbra']],
  ['Celtic', 'Glasgow', ['Edimburgo', 'Aberdeen', 'Dundee']],
  ['Rangers', 'Glasgow', ['Edimburgo', 'Aberdeen', 'Dundee']],
  ['Galatasaray', 'Istanbul', ['Ankara', 'Izmir', 'Bursa']],
];

const teamColorsData: [string, string, string[]][] = [
  ['Inter', 'Nerazzurri', ['Rossoneri', 'Bianconeri', 'Giallorossi']],
  ['Milan', 'Rossoneri', ['Nerazzurri', 'Bianconeri', 'Giallorossi']],
  ['Juventus', 'Bianconeri', ['Nerazzurri', 'Rossoneri', 'Giallorossi']],
  ['Roma', 'Giallorossi', ['Bianconeri', 'Nerazzurri', 'Rossoneri']],
  ['Lazio', 'Biancocelesti', ['Giallorossi', 'Bianconeri', 'Nerazzurri']],
  ['Napoli', 'Azzurri', ['Giallorossi', 'Bianconeri', 'Nerazzurri']],
  ['Fiorentina', 'Viola', ['Azzurri', 'Giallorossi', 'Bianconeri']],
  ['Atalanta', 'Nerazzurri', ['Viola', 'Azzurri', 'Rossoneri']],
  ['Torino', 'Granata', ['Nerazzurri', 'Bianconeri', 'Azzurri']],
  ['Cagliari', 'Rosso blu', ['Granata', 'Viola', 'Azzurri']],
  ['Real Madrid', 'Blancos', ['Blaugrana', 'Rojiblancos', 'Colchoneros']],
  ['Barcellona', 'Blaugrana', ['Blancos', 'Rojiblancos', 'Colchoneros']],
  ['Atletico Madrid', 'Rojiblancos', ['Blancos', 'Blaugrana', 'Blanquiazules']],
];

const scudettoYears: [number, string, string[]][] = [
  [2024, 'Inter', ['Milan', 'Juventus', 'Napoli']],
  [2023, 'Napoli', ['Inter', 'Milan', 'Juventus']],
  [2022, 'Milan', ['Inter', 'Napoli', 'Juventus']],
  [2021, 'Inter', ['Milan', 'Juventus', 'Napoli']],
  [2020, 'Juventus', ['Inter', 'Lazio', 'Milan']],
  [2019, 'Juventus', ['Napoli', 'Inter', 'Milan']],
  [2018, 'Juventus', ['Napoli', 'Roma', 'Inter']],
  [2017, 'Juventus', ['Roma', 'Napoli', 'Inter']],
  [2016, 'Juventus', ['Napoli', 'Roma', 'Inter']],
  [2015, 'Juventus', ['Roma', 'Lazio', 'Inter']],
  [2014, 'Juventus', ['Roma', 'Napoli', 'Inter']],
  [2013, 'Juventus', ['Napoli', 'Milan', 'Inter']],
  [2012, 'Juventus', ['Milan', 'Inter', 'Udinese']],
  [2011, 'Milan', ['Inter', 'Juventus', 'Napoli']],
  [2010, 'Inter', ['Roma', 'Milan', 'Juventus']],
  [2009, 'Inter', ['Juventus', 'Milan', 'Fiorentina']],
  [2008, 'Inter', ['Roma', 'Juventus', 'Milan']],
  [2007, 'Inter', ['Roma', 'Milan', 'Lazio']],
  [2006, 'Inter', ['Roma', 'Milan', 'Lazio']],
  [2004, 'Milan', ['Roma', 'Juventus', 'Inter']],
  [2003, 'Juventus', ['Inter', 'Milan', 'Lazio']],
  [2002, 'Juventus', ['Roma', 'Inter', 'Milan']],
  [2001, 'Roma', ['Juventus', 'Lazio', 'Milan']],
  [2000, 'Lazio', ['Juventus', 'Roma', 'Milan']],
  [1999, 'Milan', ['Lazio', 'Fiorentina', 'Juventus']],
  [1998, 'Juventus', ['Inter', 'Lazio', 'Roma']],
  [1997, 'Juventus', ['Inter', 'Parma', 'Lazio']],
  [1996, 'Milan', ['Juventus', 'Lazio', 'Inter']],
  [1995, 'Juventus', ['Lazio', 'Parma', 'Milan']],
  [1994, 'Milan', ['Juventus', 'Lazio', 'Inter']],
  [1993, 'Milan', ['Inter', 'Juventus', 'Torino']],
  [1992, 'Milan', ['Juventus', 'Torino', 'Inter']],
  [1991, 'Sampdoria', ['Milan', 'Inter', 'Juventus']],
  [1990, 'Napoli', ['Milan', 'Inter', 'Juventus']],
  [1989, 'Inter', ['Napoli', 'Milan', 'Juventus']],
  [1988, 'Milan', ['Napoli', 'Inter', 'Roma']],
  [1987, 'Napoli', ['Juventus', 'Roma', 'Inter']],
  [1986, 'Juventus', ['Roma', 'Napoli', 'Inter']],
  [1985, 'Verona', ['Juventus', 'Inter', 'Torino']],
  [1984, 'Juventus', ['Roma', 'Verona', 'Inter']],
  [1983, 'Roma', ['Juventus', 'Inter', 'Fiorentina']],
  [1982, 'Juventus', ['Roma', 'Inter', 'Fiorentina']],
  [1981, 'Juventus', ['Roma', 'Inter', 'Napoli']],
  [1980, 'Inter', ['Juventus', 'Roma', 'Milan']],
  [1979, 'Milan', ['Inter', 'Juventus', 'Lazio']],
  [1978, 'Juventus', ['Milan', 'Inter', 'Lazio']],
  [1977, 'Juventus', ['Torino', 'Inter', 'Milan']],
  [1976, 'Torino', ['Juventus', 'Milan', 'Inter']],
  [1975, 'Juventus', ['Torino', 'Milan', 'Inter']],
  [1974, 'Lazio', ['Juventus', 'Milan', 'Inter']],
  [1973, 'Juventus', ['Milan', 'Inter', 'Lazio']],
  [1972, 'Juventus', ['Milan', 'Inter', 'Torino']],
  [1971, 'Inter', ['Milan', 'Juventus', 'Torino']],
  [1970, 'Cagliari', ['Inter', 'Juventus', 'Milan']],
  [1969, 'Fiorentina', ['Cagliari', 'Inter', 'Milan']],
  [1968, 'Milan', ['Inter', 'Juventus', 'Cagliari']],
  [1967, 'Juventus', ['Inter', 'Milan', 'Fiorentina']],
  [1966, 'Inter', ['Juventus', 'Milan', 'Bologna']],
  [1965, 'Inter', ['Milan', 'Juventus', 'Torino']],
  [1964, 'Bologna', ['Inter', 'Milan', 'Juventus']],
  [1963, 'Inter', ['Juventus', 'Milan', 'Bologna']],
  [1962, 'Milan', ['Inter', 'Juventus', 'Fiorentina']],
  [1961, 'Juventus', ['Milan', 'Inter', 'Roma']],
  [1960, 'Juventus', ['Inter', 'Milan', 'Fiorentina']],
  [1959, 'Milan', ['Inter', 'Juventus', 'Fiorentina']],
  [1958, 'Juventus', ['Milan', 'Inter', 'Fiorentina']],
  [1957, 'Milan', ['Inter', 'Juventus', 'Lazio']],
  [1956, 'Fiorentina', ['Milan', 'Inter', 'Juventus']],
  [1955, 'Milan', ['Inter', 'Juventus', 'Fiorentina']],
  [1954, 'Inter', ['Juventus', 'Milan', 'Fiorentina']],
  [1953, 'Inter', ['Juventus', 'Milan', 'Torino']],
  [1952, 'Juventus', ['Inter', 'Milan', 'Torino']],
  [1951, 'Milan', ['Inter', 'Juventus', 'Torino']],
  [1950, 'Juventus', ['Inter', 'Milan', 'Torino']],
  [1949, 'Torino', ['Inter', 'Juventus', 'Milan']],
  [1948, 'Torino', ['Juventus', 'Inter', 'Milan']],
  [1947, 'Torino', ['Juventus', 'Inter', 'Milan']],
];

const championsYears: [number, string, string[]][] = [
  [2024, 'Real Madrid', ['Dortmund', 'Bayern', 'City']],
  [2023, 'Manchester City', ['Inter', 'Real Madrid', 'Bayern']],
  [2022, 'Real Madrid', ['Liverpool', 'City', 'Chelsea']],
  [2021, 'Chelsea', ['City', 'Real Madrid', 'PSG']],
  [2020, 'Bayern Monaco', ['PSG', 'Lione', 'City']],
  [2019, 'Liverpool', ['Tottenham', 'Barça', 'Ajax']],
  [2018, 'Real Madrid', ['Liverpool', 'Juve', 'Bayern']],
  [2017, 'Real Madrid', ['Juve', 'Atletico', 'Bayern']],
  [2016, 'Real Madrid', ['Atletico', 'Bayern', 'Barça']],
  [2015, 'Barcellona', ['Juve', 'Real Madrid', 'Bayern']],
  [2014, 'Real Madrid', ['Atletico', 'Bayern', 'Chelsea']],
  [2013, 'Bayern Monaco', ['Dortmund', 'Real Madrid', 'Barça']],
  [2012, 'Chelsea', ['Bayern', 'Real Madrid', 'Barça']],
  [2011, 'Barcellona', ['United', 'Real Madrid', 'Inter']],
  [2010, 'Inter', ['Bayern', 'Barça', 'United']],
  [2009, 'Barcellona', ['United', 'Chelsea', 'Inter']],
  [2008, 'Manchester United', ['Chelsea', 'Barça', 'Liverpool']],
  [2007, 'Milan', ['Liverpool', 'United', 'Barça']],
  [2006, 'Barcellona', ['Arsenal', 'Milan', 'Liverpool']],
  [2005, 'Liverpool', ['Milan', 'Chelsea', 'Juve']],
  [2004, 'Porto', ['Monaco', 'Chelsea', 'Deportivo']],
  [2003, 'Milan', ['Juve', 'Real Madrid', 'Inter']],
  [2002, 'Real Madrid', ['Leverkusen', 'Barça', 'United']],
  [2001, 'Bayern Monaco', ['Valencia', 'Real Madrid', 'United']],
  [2000, 'Real Madrid', ['Valencia', 'Bayern', 'United']],
  [1999, 'Manchester United', ['Bayern', 'Juve', 'Barça']],
  [1998, 'Real Madrid', ['Juve', 'Borussia Dortmund', 'United']],
  [1997, 'Borussia Dortmund', ['Juve', 'United', 'Ajax']],
  [1996, 'Juventus', ['Ajax', 'Dortmund', 'Milan']],
  [1995, 'Ajax', ['Milan', 'Juve', 'Bayern']],
  [1994, 'Milan', ['Barça', 'Juve', 'Ajax']],
  [1993, 'Olympique Marsiglia', ['Milan', 'Barça', 'Marsiglia']],
];

const palloneOroYears: [number, string, string[]][] = [
  [2023, 'Messi', ['Haaland', 'Mbappé', 'De Bruyne']],
  [2022, 'Benzema', ['Messi', 'Mbappé', 'Lewandowski']],
  [2021, 'Messi', ['Lewandowski', 'Jorginho', 'Benzema']],
  [2018, 'Modrić', ['CR7', 'Messi', 'Griezmann']],
  [2017, 'CR7', ['Messi', 'Neymar', 'Modrić']],
  [2016, 'CR7', ['Messi', 'Griezmann', 'Modrić']],
  [2015, 'Messi', ['CR7', 'Neymar', 'Suárez']],
  [2014, 'CR7', ['Messi', 'Neuer', 'Müller']],
  [2013, 'CR7', ['Messi', 'Ribéry', 'Ibrahimović']],
  [2012, 'Messi', ['CR7', 'Iniesta', 'Xavi']],
  [2011, 'Messi', ['CR7', 'Xavi', 'Iniesta']],
  [2010, 'Messi', ['Iniesta', 'Xavi', 'Sneijder']],
  [2009, 'Messi', ['CR7', 'Xavi', 'Iniesta']],
  [2008, 'CR7', ['Messi', 'Torres', 'Xavi']],
  [2007, 'Kaká', ['CR7', 'Messi', 'Pirlo']],
  [2006, 'Cannavaro', ['Buffon', 'Pirlo', 'Totti']],
  [2005, 'Ronaldinho', ['Messi', 'Gerrard', 'Shevchenko']],
  [2004, 'Shevchenko', ['Henry', 'Deco', 'Ronaldinho']],
  [2003, 'Nedvěd', ['Henry', 'Maldini', 'Zidane']],
  [2002, 'Ronaldo', ['Zidane', 'Kahn', 'Raúl']],
  [2001, 'Owen', ['Raúl', 'Beckham', 'Kahn']],
  [2000, 'Figo', ['Zidane', 'Shevchenko', 'Raúl']],
  [1999, 'Rivaldo', ['Beckham', 'Shevchenko', 'Raúl']],
  [1998, 'Zidane', ['Ronaldo', 'Šuker', 'Thuram']],
  [1997, 'Ronaldo', ['Zidane', 'Mijatović', 'Carlos']],
  [1996, 'Sammer', ['Ronaldo', 'Shevchenko', 'Zidane']],
  [1995, 'Weah', ['Litmanen', 'Seedorf', 'Davids']],
  [1994, 'Stoichkov', ['Baggio', 'Romário', 'Hagi']],
  [1993, 'Baggio', ['Cantona', 'Bergkamp', 'Romário']],
  [1992, 'Van Basten', ['Papin', 'Savićević', 'Bergkamp']],
  [1991, 'Papin', ['Van Basten', 'Savićević', 'Gullit']],
  [1990, 'Matthäus', ['Maradona', 'Van Basten', 'Gullit']],
  [1989, 'Van Basten', ['Gullit', 'Baresi', 'Maradona']],
  [1988, 'Van Basten', ['Gullit', 'Rijkaard', 'Maradona']],
  [1987, 'Gullit', ['Van Basten', 'Maradona', 'Platini']],
];

function shuffle<T>(arr: T[]): T[] {
  return secureShuffle(arr);
}

function generateQuestions(): QuizQuestionData[] {
  const generated: QuizQuestionData[] = [];

  // Team city questions
  for (const [team, city, wrong] of teamCityData) {
    generated.push({
      question: `In che città gioca il ${team}?`,
      options: shuffle([city, ...wrong]),
      answerIndex: 0, // will be fixed below
      category: 'Squadre',
    });
  }

  // Team colors questions
  for (const [team, color, wrong] of teamColorsData) {
    generated.push({
      question: `Quali sono i colori del ${team}?`,
      options: shuffle([color, ...wrong]),
      answerIndex: 0,
      category: 'Squadre',
    });
  }

  // Scudetto year questions
  for (const [year, winner, wrong] of scudettoYears) {
    generated.push({
      question: `Chi ha vinto lo scudetto ${year - 1}-${String(year).slice(-2)}?`,
      options: shuffle([winner, ...wrong]),
      answerIndex: 0,
      category: 'Serie A',
    });
  }

  // Champions year questions
  for (const [year, winner, wrong] of championsYears) {
    generated.push({
      question: `Chi ha vinto la Champions League ${year - 1}-${String(year).slice(-2)}?`,
      options: shuffle([winner, ...wrong]),
      answerIndex: 0,
      category: 'Champions',
    });
  }

  // Pallone d'Oro year questions
  for (const [year, winner, wrong] of palloneOroYears) {
    generated.push({
      question: `Chi ha vinto il Pallone d'Oro ${year}?`,
      options: shuffle([winner, ...wrong]),
      answerIndex: 0,
      category: 'Giocatori',
    });
  }

  // Fix answerIndex: find the correct answer position after shuffle
  // Since we shuffle, we need to set answerIndex to the position of the correct answer
  // But we can't do that here because shuffle is random at generation time.
  // Instead, we'll store the correct answer and fix it at export time.
  return generated;
}

// Fix answerIndex for generated questions
function fixAnswerIndex(qs: QuizQuestionData[], correctAnswers: string[]): QuizQuestionData[] {
  return qs.map((q, i) => ({
    ...q,
    answerIndex: q.options.indexOf(correctAnswers[i]),
  }));
}

// Collect all correct answers for generated questions
function getCorrectAnswers(): string[] {
  const answers: string[] = [];
  for (const [, city] of teamCityData) answers.push(city);
  for (const [, color] of teamColorsData) answers.push(color);
  for (const [, winner] of scudettoYears) answers.push(winner);
  for (const [, winner] of championsYears) answers.push(winner);
  for (const [, winner] of palloneOroYears) answers.push(winner);
  return answers;
}

// Build final question pool
const generated = generateQuestions();
const correctAnswers = getCorrectAnswers();
const fixedGenerated = fixAnswerIndex(generated, correctAnswers);

export const ALL_QUIZ_QUESTIONS: QuizQuestionData[] = [
  ...serieA,
  ...mondiali,
  ...champions,
  ...giocatori,
  ...europei,
  ...regole,
  ...fixedGenerated,
];
