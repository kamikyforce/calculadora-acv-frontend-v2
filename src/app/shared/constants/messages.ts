export const MESSAGES = {
  MUT: {
    SUCESSO: {
      CRIADO: 'Fator MUT criado com sucesso!',
      ATUALIZADO: 'Fator MUT atualizado com sucesso!',
      EXCLUIDO: 'Fator MUT excluído com sucesso!',
      IMPORTADO: 'Fatores MUT importados com sucesso!'
    },
    SUCESSO_IMPORTAR: 'Fatores MUT importados com sucesso!',
    SUCESSO_CRIAR: 'Fator MUT criado com sucesso!',
    NOME_DUPLICADO: 'Nome já existe no sistema',
    PERMISSAO_CRIAR: 'Você não tem permissão para criar fatores MUT',
    PERMISSAO_EDITAR: 'Você não tem permissão para editar fatores MUT',
    PERMISSAO_REMOVER: 'Você não tem permissão para remover fatores MUT',
    SUCESSO_REMOVER: 'Fator MUT removido com sucesso!',
    SUCESSO_ATUALIZAR: 'Fator MUT atualizado com sucesso!',
    VALIDACAO: {
      CAMPO_OBRIGATORIO: 'Preencha todos os campos obrigatórios corretamente.',
      CAMPO_INVALIDO: 'Campo inválido',
      NOME_OBRIGATORIO: 'Nome é obrigatório',
      NOME_MINIMO: 'Nome deve ter pelo menos 3 caracteres',
      NOME_MAXIMO: 'Nome deve ter no máximo 100 caracteres',
      NOME_TAMANHO_MINIMO: 'Nome deve ter pelo menos 3 caracteres',
      NOME_TAMANHO_MAXIMO: 'Nome deve ter no máximo 100 caracteres',
      DESCRICAO_OBRIGATORIA: 'Descrição é obrigatória',
      DESCRICAO_MINIMA: 'Descrição deve ter pelo menos 10 caracteres',
      DESCRICAO_MAXIMA: 'Descrição deve ter no máximo 500 caracteres',
      MINIMO_CARACTERES: 'Deve ter pelo menos {min} caracteres',
      MAXIMO_CARACTERES: 'Deve ter no máximo {max} caracteres',
      VALOR_MINIMO: 'Valor deve ser maior ou igual a {min}',
      VALOR_MAXIMO: 'Valor deve ser menor ou igual a {max}',
      DECIMAL_INVALIDO: 'Formato decimal inválido',
      COMBINACAO_USO_INVALIDA: 'Combinação de uso inválida'
    },
    CONFIRMACAO: {
      TITULO_DESCARTAR: 'Descartar alterações',
      TITULO_SALVAR: 'Confirmar salvamento',
      CANCELAR_EDICAO: 'Existem mudanças não salvas. Tem certeza que deseja sair sem salvar?',
      CONFIRMAR_SALVAMENTO: 'Confirmar o salvamento deste fator MUT?',
      CONFIRMAR_CADASTRO: 'Confirmar o cadastro deste fator MUT?',
      BOTAO_VOLTAR: 'Voltar à edição',
      BOTAO_DESCARTAR: 'Descartar',
      BOTAO_SALVAR: 'Salvar',
      BOTAO_CANCELAR: 'Cancelar'
    },
    ERRO: {
      CARREGAR: 'Erro ao carregar fatores MUT',
      CRIAR: 'Erro ao criar fator MUT',
      ATUALIZAR: 'Erro ao atualizar fator MUT',
      EXCLUIR: 'Erro ao excluir fator MUT',
      IMPORTAR: 'Erro ao importar fatores MUT',
      SELECIONAR_ARQUIVO: 'Selecione um arquivo Excel para importar.',
      CONEXAO: 'Erro de conexão com o servidor. Verifique sua conexão de internet.',
      SERVIDOR_INTERNO: 'Erro interno do servidor. Tente novamente mais tarde.',
      ITEM_JA_REMOVIDO: 'Este item já foi removido por outro usuário.',
      VERIFICAR_ITEM: 'Erro ao verificar item. Tente novamente.',
      ITEM_NAO_ENCONTRADO: 'Item não encontrado no servidor.',
      EXCLUIR_ITEM: 'Falha na remoção. Item restaurado na lista.',
      ERRO_LOGOUT: 'Erro ao sair do sistema',
      ARQUIVO_INVALIDO: 'Arquivo inválido',
      ARQUIVO_MUITO_GRANDE: 'Arquivo muito grande',
      IMPORTACAO: 'Erro ao importar arquivo',
      NOME_DUPLICADO: 'Nome já existe no sistema',
      SALVAR_EDICAO: 'Erro ao salvar edição',
      SALVAR_CADASTRO: 'Erro ao salvar cadastro',
      ITEM_EM_USO: 'Este item não pode ser removido pois está sendo usado em cálculos.',
      PERMISSAO_INSUFICIENTE: 'Você não tem permissão para realizar esta operação.',
      DADOS_INVALIDOS: 'Os dados fornecidos são inválidos.',
      SERVIDOR_INDISPONIVEL: 'Servidor temporariamente indisponível. Tente novamente em alguns instantes.'
    },
    PLACEHOLDERS: {
      NOME: 'Digite o nome do fator MUT',
      DESCRICAO: 'Digite a descrição'
    }
  },
  GUARD: {
    SEM_PERMISSAO: 'Você não tem permissão para acessar esta funcionalidade.'
  },
  AUTH: {
    ERRO_LOGOUT: 'Erro ao sair do sistema'
  },
  FORM: {
    ERROS_VALIDACAO: 'Existem erros de validação no formulário'
  }
};