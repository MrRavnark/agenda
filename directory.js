(function () {
  const rawPatients = `
Amanda Duraes Santos
Fernanda Caroline Ferreira França
Gabriela Gomes de Oliveira Santos Feminino
Gabriela Santini Medeiros Lopes
Isabela dos Santos Freire Gonçalves
Kimberley Garcia Huaygua
Sabrina dos Santos Costa
Jéssica Rocha dos Santos
Alexandre Rodrigues Crivelaro Souza
Ammar Mahmoud El Semidi
André Hlebanja Tavares de Oliva
André Luiz Soares
Daniel
Ivo Roberto Santarem Teles
João Pedro Baldo Dos Santos
Julio Warken Zabaleta
Marcos Rodrigues da Silva
Rodrigo Chafik Choueiri
Wendel de Melo Barboza dos Santos
Wilian Lourenço da Silva
Lourran Sousa
Priscila Albertina Natal
Pedro Masiero Credidio
Raphael Pereira Domingos
João Gabriel Rubio Rodrigues
Maria Luiza de Souza Bazan
Maria Valentina Masiero Nicola
Aguinaldo Silvestre Domingues de Castro
Fernando Nunes Serafim
Iris Caroline de Lima Menez
Larissa Cristine Lopes da Silva
Luiza Santos Antonialli
Marcelo Sanches Martins
Miriam Cristina Ravelli
Natalia Novaes de Sá Thomaz
Sara Dias
Tamires dos Santos Nascimento
Gabriela Catarina Duran Albuquerque
João Gabriel Galera Ribeiro
Ana Beatriz Santos Negri
Caroline de Andrade Ferigato
Enzo Bernal de Almeida
Julia Pinto Gama de Moraes
Luiz Henrique Pizzo da Silva
Manuela Novaes de Sá Thomaz
Mirella Sofia Garcia Huaygua
Pedro Henrique Galdino Dominguez
Ana Flavia Leal Caetano Pinto
André Rodrigues Melinski
Bruno Storel
Juliana Rodrigues de Freitas
Julio Castro da Silva
Laís Fernandes Silva
Larissa Giusti
Murilo Barberini Dias
Paulo Cesar Marusso
Silvio Bizerra da Silva
Diego Hideo Yamashiro
Rodrigo Candido Afonso Vilela
Ricardo Mascarenhas de Meneses
Enzo Claus Faustino
Mateus Galdini de Pinho
Isadora Neris de Carvalho
Laura Ferreira Alencar
Sarah de Oliveira Barreto
Maurício Pereira da Silva
Davi da Paixão Bartoli
Luís Gustavo de Oliveira Lomba
Maria Eduarda Policarpo
Mirella Sofia Garcia Huaygua
Rafael Baldoni
Ester Gimenez Porfírio de Almeida
Fernanda Luísa Alves Bergamo Rodrigues
Rafaela Sanches Rosa
Diana Domingues de Castro
João Gabriel Gambetti de Souza
João Vinícius Pizzo da Silva
Lorenzo Portela Inácio de Souza
Miguel Dalbello
Arthur Brandt Maronato Guimarães
Daniel Fancchini Nunes
Aline Wachtler Timm
Ana Carolina Domingues de Castro
Ana Elza Gomes Ferreira
Angela Maria Todeschini
Bruna Rafaela Gambetti
Carina Calegari Masiero
Debora Serrano de Souza
Fabio Lucio Ribeiro
Fabio Rossini Lopes
Felipe Pinto Guersoni Gama
Giulliana Bolognani Pasian
Kérolaine Matos Neves
Lilian Regina Cubica Pena
Marcia Messias Garcia
Mariana Andreiuolo Couto
Michele Galardi de Meneses
Naími Folco Loureiro Barros
Raquel Batista Silva
Rebecca de Assis Iori
Sabrina Ribeiro Bertoluci
Victor Hugo Silva Boens
Maria Barboza Belvis
Adriana da Silva Guersoni Gama
Antonio Adão Fabeni Sobreiro
Bruna Sousa Coppi
Daniela Viera Alves
Denise Debora de Souza
Felipe Rivera Sesoko
Gabriela Aparecida de Almeida
Marcella Braun de Aguiar Cruz
Michele Vatam
Nadia Assuncao Ribeiro
Steffany Motta dos Anjos
Natalie Marcao Pereira da Silva
Thawane Silva Dias
Alice Ferreira Soares
Arthur Vinícius Cubica Pena
Francisco Bianchi de Souza
Gianluigi Batista Sobreiro
Heitor Galdino Dominguez
Helena de Souza Bazan
Isaac Portela
Laura de Oliveira Barreto
Lorenzo Coelho Vicente Serafim
Maite de Souza Ladeia
Maria Clara Rocha Baltazar Francisco
Theo Ciurvis
Alex Salvi
Amanda Delfino Miranda
Antonio Adão Fabeni Sobreiro
Bruno Pereira da Conceição
Camila Coelho Vicente Serafim
Camila Fonseca Talarico Soares
Camilla Cremacio
Carolina Gois Vicente Francisco
Carolina Ribas Rodrigues Neto
Daniela Borges Benzatti
Debora Claus Faustino
Deise Marcelino Bonacci Conegero
Denise Saqueto
Evelin Fagundes Vieira Alves
Fernanda Soares Braz Souza
Gabriela Salomão Pimentel
Isabelle Motta dos Anjos
Jamare Cristina Pizzo
Jessica Ispada
Juliana Lozano Rodrigues de Oliveira Zambelli
Karina Rocha Caetano
Larissa Lozano Rodrigues de Oliveira
Maikel Carmona
Maria Aurora de Jesus Ferreira Primuk
Maria de Fátima Fonseca
Mariana Manini Moreira Ziliotti
Pedro Henrique Lacerda Fernandes
Renata da Rocha Cristale
Roselene Vasques
Sandra Regina Gabira Moreno
Selma Marcao Pereira da Silva
Simone Cristina de Abreu Bessa
Simone Perez Sanches Cruz
Thamila Gomes Galdino Ciurvis
Ana Julia Negri Corre
Beatriz Falcão Henriques Ferreira
Evandro Sabonaro Salute
Isadora Sperandio Peixoto
Julia Gomes Mantovani
Lana Almeida Lopes
Giovanna Pereira Fiorese
Diogo Buffoni
Jonatas Sueiro
Livia Kaori H Sartorelli
Nicolas Yuki Hutter Sekisawa
Fernanda Hutter
Joaquim Lice Fernandes
Myriam Virginia Pereira Pinto
Heitor Bezerra Almicce
Cesar Viana Carneiro
Hellen Fernandes Alves
Saulo Ramos Cunha
Eliza Marchi Bessa
Marli Gimenez Porfirio de Almeida
Luciana Soares Motta
João Carlos dos Santos
Pietra de Oliveira Alonso Menezes Alvim
Pascal Mateus Menezes de Faria Alvim
Ricardo Barros Folco
Sophia Barros Folco
Ana Paula Marchi Silva Bessa
Rafael Tavares Bessa
Livia Markoski Ferreira
Laís Markoski Ferreira
Marina Akhtyamova Kiss Righetto
Gabriel Branco Sarmento
Matteo Garcia Huaygua
Mirella Sofia Garcia Huaygua
Elisoete Francisca Lima
Heitor Leão Simões
Guilherme Melo
Gustavo Sartori Shibata Grigoleto
Davi Todeschini
João Francisco Marchi da Silva
Antonio Bento Marchi Silva
Luciene Miranda De Oliveira
Aldo Canzona dos Santos
Anderson XavierSimões
André Luiz Toyama Carneiro
Anna Manaia Carneiro
Maria Helena Gabira Martinelli
Emmily Vitória Ângelo de Lima
Catarina Costa Mina
Arthur Pinto Gama de Moraes
Luciano Pereira Garcia
Kaue Garcia Machado
Larissa Marques de Oliveira
Luiz Paulo Garcia Machado
Davi de Oliveira Garcia
Thiago Mageika
Guilherme Fiorese
Matias DEstefani Gonçalves
Noah Wachtler Timm
Maria Inês Andreiuolo
Daniele Silva de Arruda
Jaqueline De Lima Santos Valero
Gabriel Bertoletti Gusson
Guilhermo Enricco Bagatella das Chagas
Maria Carolina Marchi Silva
Vanessa Ricci Carmona
Maria Helena Fonseca de Castro
Nycolle Fernandes Marinho
Nikola Arruda Morais
Dante Albert Arruda Bezerra
Gabriel Moralles
Amaro Bezerra da Silva Neto
Gabriela Seabra
Theo de Moura Ferreira
Marianna Wachtler Iamamoto
Luis Guilherme Giacomo Marcassa Benedetti
Lais De Souza Monteiro
Helena Ribeiro Amâncio
Roberto Ramos
Camilly Wenceslau Ribeiro
Nicolas Pinheiro da Silva
Thiago Barros Morais
Nelsi Warken
Mariana Ferreira Gomes
Giulia Barbosa de Carvalho
Ana Paula Negri
Beatriz Akemi Nashimoto Braz
Maria Fátima Gomes dos Santos
Gustavo Sladic
Nicole Yumi Nashimoto Braz
Alessandro Alves dos Santos
Bruna Castro
Deise Marcelino Bonacci Conegero
Daniele Aparecida Santos Moura
Alan Vidotti Prando
Eduardo Henrique Ferreira Sales
Rosemeire Belvis
Rosangela Pereira
Giovanna Silva Rodrigues
Paulo Ricardo Barros Pereira da Silva
Naími Folco Loureiro Barros
Samuel
Theo Valente Tezoto
Vanessa Bugni Miotto e Silva
Eder Eiji Miyamura
Daniela Maira Abe Miyamura
Bianca Naccarato Zullato
Danielle Martins Ashfield
Camila Ferreira
Ricardo Vita Meyer
João Victor Salcedo
Michel Figueiredo Mantovani
Heitor de Souza Nogueira
Natália Lopes Vieira
Ana Cristina Dias Ribeiro
Mercia Barbosa de Mello
Larissa Maria Silva de Arruda
Giuliano Goncalez Baldi
Valdeci Silverio
Marina Andreiuolo Couto
Enrico Cappelli Freitas
Natália de Mattos Urnikes Marin
Eduardo Abe Miyamura
Carolina Abe Miyamura
Eduardo Cypriano Gomes
César Ferreira Araujo
João Henrique Mesquita Demetrio
Juliana de Fátima Pinto Gama
Luiz Henrique Garcia
Helena Arizza Choupina
Reginaldo Luiz Choupina
Débora Arizza
Ivo da Cunha Gonçalves
Luiza Martins Ortiz
Luciana Peixoto
Miriam Baldan
Ana Cristina Dias Ribeiro Lozano
Lucas Costa Andrade de Oliveira
Naomi Masutani dos Santos
Lilian Yukari Masutani
Carlos Henrique De Figueiredo Ferreira
Pietro Silva Barbosa Catena
Rogério de Sá Martins
Aline Xavier Vieira
Beatriz Branco Sarmento
Ana Paula Martins Donega
Lucas Afonso Ribeiro de Melo
Alexandre Tadeu Botaro
Maria Luiza Baldi Baptista
Romeo
José Luiz Capelli
Luiza Bernardino Felix
Laura Masiero Credidio
Shirlei Rodrigues Rafael
Maria Cecília Bajak
Cláudio Yassushi Sekisawa
Diogo de Almeida Figueiredo
David de Paula Zulatto
Maiara Bagatella Zulatto
`;

  const rawPsychologists = `
Aline Lucélia Lopes Goes
Andre Prado Nunes
Claudia Cecilia Almaraz Lobos
Dr(a). Enzo Stefano Bruno Vancini
Fabiana de Almeida Pinto Todeschini
Felipe Anselmo Pereira
Giovana Barbosa De Siqueira
João Miguel Marques
Mônica Alves da Costa
Regiane Barbosa Roque
Vanessa Ricci Carmona
Veruska Rodrigues Galdini
Viviane Giunco
Zilza Olindina de Almeida Pinto
`;

  function parseNames(raw) {
    const namesByKey = new Map();

    raw
      .split(/\r?\n/)
      .map((name) => name.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .forEach((name) => {
        const key = name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase("pt-BR");

        if (!namesByKey.has(key)) {
          namesByKey.set(key, name);
        }
      });

    return Array.from(namesByKey.values()).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }

  window.AGENDA_DIRECTORY = {
    patients: parseNames(rawPatients),
    psychologists: parseNames(rawPsychologists),
  };
})();
