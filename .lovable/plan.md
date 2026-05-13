# Refatorar modal "Adicionar membros à escala"

Atualizar o componente `AddMembersSheet` em `src/pages/ScheduleNew.tsx` para ficar igual à referência enviada.

## Mudanças visuais e comportamentais

1. **Permitir adicionar qualquer membro, com ou sem função**
   - Remover o `disabled={fns.length === 0}` do `Switch` de cada membro.
   - Quando o membro não tiver função atribuída e for ligado, ele entra em uma seção genérica (rótulo `"Sem função"`) na escala.
   - Card mostra a frase `"Nenhuma função atribuída."` abaixo do nome, sem lista de checkboxes.

2. **Funções como checkboxes em seção expansível** (em vez de chips)
   - Quando o membro está ligado E possui 1 ou mais funções, exibir um cabeçalho clicável com:
     - Texto: `"X/Y funções selecionadas."`
     - Chevron (`ChevronUp` / `ChevronDown`) à direita.
   - Ao expandir, lista cada função em uma linha contendo:
     - Ícone da função (emoji `MinistryFunction.icon`, fallback discreto se vazio).
     - Nome da função.
     - `Checkbox` (componente shadcn `Checkbox`) à direita.
   - Estado de expansão controlado por `Set<string>` de `memberId`s expandidos (padrão: expandido quando o membro é ligado, igual à foto).

3. **Membro com 1 função única**
   - Continua exibindo a seção expansível (como na foto, "Joao vitor" com `1/1 funções selecionadas` + checkbox marcado).

4. **Selecionar todos**
   - Mantém o comportamento atual, mas agora também ativa membros sem função (eles entram com `functionIds: []`).

5. **Confirmação ao salvar**
   - Atualizar `applyMembersSelection` (em `ScheduleNew`) para criar/usar um slot `"Sem função"` quando o membro foi marcado mas não tem nenhuma função selecionada.
   - Hoje a função apenas itera `fnIds`; precisa adicionar o caso de array vazio → adicionar membro a um slot padrão.

## Arquivo afetado

- `src/pages/ScheduleNew.tsx` (somente o componente `AddMembersSheet` e a função `applyMembersSelection`).

## Fora de escopo

- Indicador "Indisponível nesta data" (visto na foto no Miguel) — depende de feature de indisponibilidade ainda não existente. Posso adicionar depois se quiser.
- Mudanças em layout fora do modal.
