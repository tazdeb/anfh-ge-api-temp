var through = require('through2');
var moment = require('moment');

var INDEX_1_1 = 'par_1_1';

module.exports = function(esHelpers) {
  var docActionModif = function() {
    return through.obj(function(obj, enc, cb) {
      if (obj.nature === 'N') {
        delete obj._id
        obj._publie = false;
        obj.region = 'NAT';
        delete obj.code;
        delete obj.axe;
        obj.planifications = [];
        obj.derniereModif = moment().toISOString();

        this.push(obj);
      }

      cb();
    });
  };

  var upDateDerniereModif = function() {
    return through.obj(function(obj, enc, cb) {
      if (obj.nature === 'N' && obj.region !== 'NAT') {
        obj.derniereModif = moment().toISOString();

        this.push(obj);
      }

      cb();
    });
  };

  var copyNatActions = function(docsStream, docType) {
    return docsStream
      .pipe(docActionModif())
      .pipe(esHelpers.bulker())
        .on('end', function() {
          console.info('Succès de la copie nationale des documents DOCTYPE sur l\'index'.replace('DOCTYPE', docType), INDEX_1_1);
        })
        .on('error', function(err) {
          console.info('Echec de la copie nationale des documents DOCTYPE sur l\'index'.replace('DOCTYPE', docType), INDEX_1_1);
        });

  };

  var issue141 = function(docsStream) {
    return docsStream
      .pipe(upDateDerniereModif())
      .pipe(esHelpers.bulker())
        .on('end', function() {
          console.info('Succès de la mise à jour de la date de dernère modif des actions nationales en délégation sur l\'index', INDEX_1_1);
        })
        .on('error', function(err) {
          console.info('Echec de la mise à jour de la date de dernère modif des actions nationales en délégation sur l\'index', INDEX_1_1);
        });

  };

  return {
    indexSiege: function() {
      var siege = {
        index: INDEX_1_1,
        type: 'regions',
        id: 'NAT',
        body: {
          'code': 'NAT',
          'denomination': 'Siège',
          'derniereModif': moment().toISOString()
        }
      };

      esHelpers.index(siege);
    },

    copyNatActions: function(actionsStream) {
      return copyNatActions(actionsStream, 'actions');
    },

    issue141: function(actionsStream) {
      return issue141(actionsStream);
    }

  }
};
