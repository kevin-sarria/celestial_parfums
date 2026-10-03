import { describe, expect, it } from 'vitest';
import { campoDescripcion, descripcionHtml, textoPlano } from './textoEnriquecido';

describe('descripciones con formato', () => {
  it('el texto de antes respeta los ** y los saltos de línea', () => {
    expect(descripcionHtml('✨ **Lleva tu aroma** ✨\n\nPerfumero <recargable>\ny práctico'))
      .toBe('<p>✨ <strong>Lleva tu aroma</strong> ✨</p><p>Perfumero &lt;recargable&gt;<br />y práctico</p>');
  });

  it('el HTML del editor se limpia: se quedan los formatos y se va el código', () => {
    expect(descripcionHtml('<p><b>Hola</b><script>alert(1)</script><img src=x onerror=alert(1)></p>'))
      .toBe('<p><b>Hola</b><img src="x" /></p>');
  });

  it('vacío o solo etiquetas vacías es null', () => {
    expect(descripcionHtml('')).toBeNull();
    expect(descripcionHtml('<p><br></p>')).toBeNull();
  });

  it('para Google y WhatsApp sale texto de una línea, sin etiquetas ni asteriscos', () => {
    expect(textoPlano('<p>Fresco &amp; <strong>amaderado</strong></p><ul><li>6 h</li></ul>'))
      .toBe('Fresco & amaderado 6 h');
    expect(textoPlano('**Pequeño** y elegante')).toBe('Pequeño y elegante');
  });

  it('el formulario guarda saneado, y lo que el editor deja al borrarlo todo queda vacío', () => {
    const campo = campoDescripcion();
    expect(campo.parse('<p>ok<script>x</script></p>')).toBe('<p>ok</p>');
    expect(campo.parse('<br>')).toBe('');
    expect(campo.parse(null)).toBeNull();
  });
});
