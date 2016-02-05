(function() {
  // File System : Permet de faire des lectures/écritures sur le système de fichiers
  var fs     = require('fs');
  // Simple XML to JavaScript object converter
  var xml2js = require('xml2js');
  // An HTML to Markdown converter written in JavaScript.
  var toMarkdown = require('to-markdown');
  // Parse, validate, manipulate, and display dates in JavaScript.
  var moment = require('moment');

  var parser = new xml2js.Parser();

  var toMarkdownOptions = {
    converters: [
      {
        filter: 'div',
        replacement: function(content) {
          return '\n\n' + content;
        }
      },
      {
        filter: 'span',
        replacement: function(content) {
          return content;
        }
      },
    ]
  };

  // Dictionnaire associant au nom d'une région son code ANFH
  var regionCodes = {
    'Alpes':'ALP',
    'Alsace':'ALS',
    'Aquitaine':'AQU',
    'Auvergne':'AUV',
    'Basse-Normandie':'BAS',
    'Bourgogne':'BGN',
    'Bretagne':'BRE',
    'Centre':'CEN',
    'Champagne-Ardenne':'CHA',
    'Corse':'COR',
    'Franche-Comté':'FRA',
    'Guyane':'DGY',
    'Haute-Normandie':'HAU',
    'Île-de-France':'IDF',
    'Languedoc-Roussillon':'LAN',
    'Limousin':'LIM',
    'Lorraine':'LOR',
    'MARTINIQUE':'DMA',
    'Midi-Pyrénées':'MID',
    'Nord-Pas de Calais':'NOR',
    'Océan Indien':'REU',
    'PACA ':'PRO',
    'Pays de la Loire':'PAY',
    'Picardie':'PIC',
    'Poitou-Charentes':'POI',
    'Rhône':'RHO'
  };

  // Crée le répertoire de sortie, s'il n'existe pas
  try {
    fs.accessSync('es-bulk');
    console.log('Répertoire \'es-bulk\' existant');
  } catch(err) {
    fs.mkdir('es-bulk', function(err) {
      if (err) {
        return console.error('Impossible de créer le répertoire \'es-bulk\'', err);
      }
      console.log('Répertoire \'es-bulk\' créé');
    });
  }


  fs.readFile(__dirname + '/export-supersoniks/export_formations.xml', function(err, data) {
    parser.parseString(data, function (err, result) {

      // Juste pour voir
      // fs.writeFile('es-bulk/export-supersoniks.json', JSON.stringify(result), function(err) {
      //   if (err) {
      //     throw err;
      //   }
      // });

      // Itère au travers des actions de formation
      var bulksData = result.node_export.node.map(function(xaction){
        return {
          src: xaction,
          target: {
            action: {}
          }
        };
      })
      .map(function(srctgt) {
        // ID
        srctgt.target._id = srctgt.src.nid[0];
        return srctgt;
      })
      .map(function(srctgt) {
        // Région
        var nodeName = Object.getOwnPropertyNames(srctgt.src.og_groups_both[0])[0]
        var codeReg = regionCodes[srctgt.src.og_groups_both[0][nodeName][0]];
        if (codeReg) {
          srctgt.target.action.region = codeReg;
        }
        return srctgt;
      })
      .map(function(srctgt) {
        // Publie
        srctgt.target.action._publie = srctgt.src.og_public[0]._ === 'TRUE';
        return srctgt;
      })
      .map(function(srctgt) {
        // Intitulé
        srctgt.target.action.intitule = srctgt.src.title[0];
        return srctgt;
      })
      .map(function(srctgt) {
        // Nature
        // Toutes les actions reprisent sont considérées comme étant régionales
        srctgt.target.action.nature = 'R';
        return srctgt;
      })
      .map(function(srctgt) {
        // Contexte
        if (typeof srctgt.src.field_contexte[0].n0[0].value[0] === 'string') {
          srctgt.target.action.contexte = toMarkdown(srctgt.src.field_contexte[0].n0[0].value[0], toMarkdownOptions).trim();
        }
        return srctgt;
      })
      .map(function(srctgt) {
        // Objectifs
        if (typeof srctgt.src.field_objectif[0].n0[0].value[0] === 'string') {
          srctgt.target.action.objectifs = toMarkdown(srctgt.src.field_objectif[0].n0[0].value[0], toMarkdownOptions).trim();
        }
        return srctgt;
      })
      .map(function(srctgt) {
        // Titulaire
        srctgt.target.action.titulaire = srctgt.src.field_organisateur[0].n0[0].value[0];
        return srctgt;
      })
      .map(function(srctgt) {
        // Publics
        srctgt.target.action.publics = srctgt.src.field_public.map(function(item) {
          if (typeof item.n0[0].value[0] === 'string') {
            return toMarkdown(item.n0[0].value[0], toMarkdownOptions).trim();
          } else {
            return null;
          }
        })
        .filter(function(public) {
          return public;
        });
        return srctgt;
      })
      .map(function(srctgt) {
        // Modules

        /*
        Il n'y a pas de notion de module dans les données reprises.
        Cependant, des informations à reprendre sont situés au niveau du module :
        - programme
        - durée

        --> On crée UN module
        --> On réplique des infos de l'action :
            - intitulé du module = intitulé de l'action
            - Formateur module = Titulaire de l'action
            - Contexte module = contexte action
            - Objectifs module = objectifs action
            - Publics module = publics action
        --> On reprend les données programme et durée ensuite
        */
        srctgt.target.action.modules = [{
          intitule: srctgt.target.action.intitule,
          contexte: srctgt.target.action.contexte,
          objectifs: srctgt.target.action.objectifs,
          formateur: srctgt.target.action.titulaire,
          publics: srctgt.target.action.publics.map(function(p) {
            // Réalise une copie des éléments du tableau
            return p;
          })
        }];
        return srctgt;
      })
      .map(function(srctgt) {
        // Programme du module
        if (typeof srctgt.src.body[0] === 'string') {
          srctgt.target.action.modules[0].programme = toMarkdown(srctgt.src.body[0], toMarkdownOptions).trim();
        }
        return srctgt;
      })
      .map(function(srctgt) {
        // Durée du module
        if (typeof srctgt.src.field_af_duree[0].n0[0].value[0] === 'string') {
          try {
            var nbJours = parseInt(srctgt.src.field_af_duree[0].n0[0].value[0]);
            srctgt.target.action.modules[0].duree = 'P' + nbJours + 'D'
          } catch (err) {
            console.warn('La durée n\'est pas un entier',  srctgt.src.field_af_duree[0].n0[0].value[0], err);
          }
        }
        return srctgt;
      })
      .map(function(srctgt) {
        // Calendrier

        /*
        On ne reprend ici que les dates de début et de fin
        La ville (ie le lieu) est repris ensuite
        */
        srctgt.target.action.calendrier = Object.getOwnPropertyNames(srctgt.src.field_date_evt[0]).filter(function(nodeName) {
          return nodeName !== '$';
        }).map(function(nodeName) {
          var n = srctgt.src.field_date_evt[0][nodeName][0];
          if (typeof n.value[0] === 'string') {
            var itemCalendrier = {
              debut: moment(n.value[0].substring(0, 'YYYY-MM-DD'.length)).format('YYYY-MM-DD'),
              fin: moment(n.value2[0].substring(0, 'YYYY-MM-DD'.length)).format('YYYY-MM-DD'),
            };

            return itemCalendrier;
          } else {
            return null;
          }
        }).filter(function(itemCalendrier) {
          return itemCalendrier;
        });

        return srctgt;
      })
      .map(function(srctgt) {
        // Calendrier : ville

        /*
        Les évènements repris dans le calendrier ne comporte pas de notion
        de ville ou de lieu.

        Il existe un champs spécifique pour le lieu de formation.
        --> On récupère ce lieu et on l'affecte comme ville à l'ensemble des
            dates du calendrier.
        */

        if (typeof srctgt.src.field_lieu_formation[0].n0[0].value[0] === 'string') {
          var lieu = srctgt.src.field_lieu_formation[0].n0[0].value[0];
          srctgt.target.action.calendrier.forEach(function(evenement) {
            evenement.ville = lieu;
          });
        }
        return srctgt;

      })
      .map(function(srctgt) {
        // Exercice

        /*
        Il n'existe pas de notion d'exercice dans les données reprise.

        On détermine l'exercice en prenant la plus petite date de début dans le calendrier
        A défaut de date dans le calendrier, on utilise le champ 'revision_timestamp'
        http://stackoverflow.com/questions/847185/convert-a-unix-timestamp-to-time-in-javascript
        */
        var exercice
        if (srctgt.target.action.calendrier.length > 0) {
          exercice = srctgt.target.action.calendrier.map(function(calendrier) {
            return parseInt(calendrier.debut.substring(0, 'YYYY'.length));
          }).reduce(function(m, exe) {
            return m < exe ? exe : m;
          });

        } else {
          // Utilisation du revision_timestamp
          exercice = new Date(parseInt(srctgt.src.revision_timestamp[0]) * 1000).getFullYear();
        }
        srctgt.target.action.exercice = exercice;

        return srctgt;
      })
      .map(function(srctgt) {
        return srctgt.target;
      })
      .filter(function(target) {
        // Rejet des actions sans code région
        if (!target.action.region) {
          console.warn('Action d\'ID ' + target._id + ' (' + target.action.intitule + ') rejetéé : Impossible de déterminer la région');
        }
        return target.action.region;
      })
      .filter(function(target) {
        // Rejet des actions sans exercice
        if (!target.action.exercice) {
          console.warn('Action d\'ID ' + target._id + ' (' + target.action.intitule + ') rejetéé : Impossible de déterminer l\'exercice');
        }
        return target.action.exercice;
      })
      .map(function(target) {

        return [
          JSON.stringify({index: {_index: 'par', _type: 'actions', _id: target._id}}),
          JSON.stringify(target.action)
        ];
      }).map(function(bulkArray) {
        return bulkArray.join('\n');
      }).join('\n');


      fs.writeFile('es-bulk/actions.json', bulksData, function(err) {
        if (err) {
          throw err;
        }
      });

    });
  });


})();