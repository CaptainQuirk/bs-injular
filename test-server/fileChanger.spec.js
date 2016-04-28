'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');

const fileChanger = require('../lib/fileChanger');

const url = require('url');

/* eslint-disable no-empty-function */
const noop = ()=>{};
/* eslint-enable no-empty-function */


describe('fileChanger', () => {

  describe('.wrapTemplate', () => {

    it('should return a string that contains the content', () => {
      let content = '<div><span>FOO</span><span>BAR</span</div>';
      let newContent = fileChanger.wrapTemplate(content, '/app/main.html');
      expect(newContent).to.contain(content);
    });

    it('should add a header comment to the content', () => {
      let content = '<div><span>FOO</span><span>BAR</span</div>';
      let newContent = fileChanger.wrapTemplate(content, '/app/main.html');
      expect(newContent).to.startWith('<!--bs-injular-start /app/main.html-->');
    });

    it('should add a footer comment to the content', () => {
      let content = '<div><span>FOO</span><span>BAR</span</div>';
      let newContent = fileChanger.wrapTemplate(content, '/app/main.html');
      expect(newContent).to.endWith('<!--bs-injular-end /app/main.html-->');
    });

  });

  describe('.appendProvideGetter', () => {

    it('should return a string that starts with the string received', () => {
      let content = `angular.module('app').controller(function(){})`;
      let newContent = fileChanger.appendProvideGetter(content, 'app');
      expect(newContent).to.startWith(content);
    });

    it('should add $controllerProvider to bsInjular when evaluated', () => {
      let content = fileChanger.appendProvideGetter('', 'app');
      let evaluate = new Function('angular', 'window', content);
      let window = {};
      let angular = {
        module: function() {
          return {
            config: function(array) {
              array[array.length-1]('$controllerProvider');
            }
          };
        }
      };
      sinon.spy(angular, 'module');

      evaluate(angular, window);

      expect(angular.module).to.have.callCount(1);
      expect(window).to.have.deep.property(
        '___bsInjular___.$controllerProvider',
        '$controllerProvider'
      );
    });

  });

  describe('.appendAngularDirectivePatch', () => {

    it('should return a string that starts with the string received', () => {
      let content = `(function(){window.angular={}})()`;
      let newContent = fileChanger.appendAngularDirectivePatch(content);
      expect(newContent).to.startWith(content);
    });
    
  });

  describe('_appendAngularDirectivePatchFunction', () => {

    it('should add directivesByUrl to bsInjular when evaluated', () => {
      let window = {};
      let angular = {
        module: noop
      };

      fileChanger._appendAngularDirectivePatchFunction(angular, window);

      expect(window).to.have.deep.property(
        '___bsInjular___.directivesByUrl'
      ).that.deep.equals({});
    });

    it('should replace angular.module when evaluated', () => {
      let window = {};
      let document = {};
      let module = noop;
      let angular = {
        module
      };

      fileChanger._appendAngularDirectivePatchFunction(angular, window, document);

      expect(angular.module).to.not.equal(module);
    });

    it('should call original angular.module when evaluated and angular.module is called', () => {
      let window = {};
      let document = {};
      let module = {};
      let moduleFn = sinon.spy(() => module);
      let angular = {
        module: moduleFn
      };

      fileChanger._appendAngularDirectivePatchFunction(angular, window, document);
      angular.module();

      expect(moduleFn).to.have.callCount(1);
    });

    it('should replace module.directive when evaluated and angular.module is called', () => {
      let window = {};
      let document = {currentScript: {src: '/foo.directive.js'}};
      let directive = noop;
      let module = {
        directive
      };
      let moduleFn = () => module;
      let angular = {
        module: moduleFn
      };

      fileChanger._appendAngularDirectivePatchFunction(angular, window, document);
      angular.module();

      expect(module.directive).to.not.equal(directive);
    });

    it('should call original module.directive with an array factory when new module.directive is called', () => {
      let window = {};
      let document = {currentScript: {src: '/foo.directive.js'}};
      let directive = sinon.spy();
      let module = {
        directive
      };
      let moduleFn = () => module;
      let angular = {
        module: moduleFn,
        injector: {$$annotate: () => []},
        isArray: Array.isArray,
        isString: (s) => {return typeof s === 'string';}
      };

      fileChanger._appendAngularDirectivePatchFunction(angular, window, document);
      angular.module().directive('foo', noop);

      expect(directive).to.have.callCount(1);
      expect(directive).to.have.been.calledWith('foo');
      expect(directive.args[0][1]).to.be.an('array').that.has.length(1);
    });

    it('should call original module.directive with an array factory when new module.directive is called', () => {
      let window = {};
      let document = {currentScript: {src: '/foo.directive.js'}};
      let directive = sinon.spy();
      let module = {
        directive
      };
      let moduleFn = () => module;
      let angular = {
        module: moduleFn,
        injector: {$$annotate: () => []},
        isArray: Array.isArray,
        isString: (s) => typeof s === 'string'
      };

      fileChanger._appendAngularDirectivePatchFunction(angular, window, document);
      angular.module().directive('foo', noop);

      expect(directive).to.have.callCount(1);
      expect(directive).to.have.been.calledWith('foo');
      expect(directive.args[0][1]).to.be.an('array').that.has.length(1);
    });

    it('should patch the directive factory in order to add the directive to bsInjular.directivesByUrl', () => {
      let moduleDirectiveFactory;
      let window = {};
      let document = {currentScript: {src: '/foo.directive.js'}, createElement};
      let module = {
        directive: (name, directiveFactory) => {
          moduleDirectiveFactory = directiveFactory[0];
        }
      };
      let moduleFn = () => module;
      let angular = {
        module: moduleFn,
        injector: {$$annotate: () => []},
        isArray: Array.isArray,
        isString: (s) => {return typeof s === 'string';}
      };

      fileChanger._appendAngularDirectivePatchFunction(angular, window, document);
      angular.module().directive('foo', () => 'foobar');
      let directive = moduleDirectiveFactory();

      expect(directive).to.equal('foobar');
      expect(window).to.have.property('___bsInjular___')
      .that.has.property('directivesByUrl')
      .that.has.property('/foo.directive.js')
      .that.has.property('foo')
      .that.has.property('0', directive);

      function createElement() {
        var href;
        return {
          set href(val) {
            href = val;
          },
          get pathname() {
            return url.parse(href).pathname;
          }
        };
      }
    });

  });

});